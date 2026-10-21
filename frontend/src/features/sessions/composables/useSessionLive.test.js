import { afterEach, expect, it, vi } from 'vitest'
vi.mock('vue', async (original) => ({
  ...(await original()),
  onBeforeUnmount: vi.fn(),
}))
import { useSessionLive } from './useSessionLive'
class FakeEventSource {
  static instances = []
  constructor(url) {
    this.url = url
    this.listeners = new Map()
    FakeEventSource.instances.push(this)
  }
  addEventListener(type, handler) {
    this.listeners.set(type, handler)
  }
  close() {
    this.closed = true
  }
  emit(data) {
    this.listeners.get('update')?.({ data: JSON.stringify(data) })
  }
}
afterEach(() => {
  delete globalThis.EventSource
  FakeEventSource.instances = []
  vi.useRealTimers()
})
it('shares a stream and supplies a roster baseline to a newly opened panel', async () => {
  globalThis.EventSource = FakeEventSource
  const first = vi.fn(),
    second = vi.fn(),
    catchUp = vi.fn()
  const a = useSessionLive({
    sessionUuid: 'session uuid',
    onUpdate: first,
    onCatchUp: catchUp,
    getChronicleCursor: () => 12,
  })
  a.start()
  const source = FakeEventSource.instances[0]
  expect(source.url).toBe('/api/sessions/session%20uuid/live?after=12')
  source.onopen()
  source.emit({
    roster: {
      data: [{ charId: 7, data: { hp: 10 } }],
      sequence: 1,
      patches: [],
    },
  })
  await vi.waitFor(() => expect(first).toHaveBeenCalledOnce())
  const b = useSessionLive({ sessionUuid: 'session uuid', onUpdate: second })
  b.start()
  expect(FakeEventSource.instances).toHaveLength(1)
  expect(second.mock.calls[0][0].roster.data[0].data.hp).toBe(10)
  expect(catchUp).not.toHaveBeenCalled()
  source.emit({
    roster: {
      fromSequence: 1,
      sequence: 2,
      patches: [
        {
          op: 'set',
          path: [{ idField: 'charId', id: 7 }, 'data', 'hp'],
          value: 9,
        },
      ],
    },
  })
  await vi.waitFor(() => expect(first).toHaveBeenCalledTimes(2))
  a.stop()
  expect(source.closed).not.toBe(true)
  b.stop()
  expect(source.closed).toBe(true)
})
it('reconnects with the current chronicle cursor and runs a bounded fallback while disconnected', async () => {
  vi.useFakeTimers()
  globalThis.EventSource = FakeEventSource
  let cursor = 2
  const catchUp = vi.fn(async () => {
    cursor = 5
  })
  const live = useSessionLive({
    sessionUuid: 'reconnect',
    onCatchUp: catchUp,
    getChronicleCursor: () => cursor,
  })
  live.start()
  const source = FakeEventSource.instances[0]
  source.onopen()
  source.onerror()
  expect(live.status.value).toBe('error')
  expect(source.closed).toBe(true)
  await vi.advanceTimersByTimeAsync(2000)
  expect(catchUp).toHaveBeenCalledOnce()
  expect(FakeEventSource.instances[1].url).toContain('after=5')
  live.stop()
})
