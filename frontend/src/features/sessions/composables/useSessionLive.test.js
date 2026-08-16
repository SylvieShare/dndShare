import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('vue', async importOriginal => {
  const actual = await importOriginal()
  return { ...actual, onBeforeUnmount: vi.fn() }
})

import { useSessionLive } from './useSessionLive'

class FakeEventSource {
  static instances = []

  constructor(url) {
    this.url = url
    this.listeners = new Map()
    FakeEventSource.instances.push(this)
  }

  addEventListener(type, handler) { this.listeners.set(type, handler) }
  removeEventListener(type) { this.listeners.delete(type) }
  close() { this.closed = true }
  emit(type, data) { this.listeners.get(type)?.({ data: JSON.stringify(data) }) }
}

describe('session live stream', () => {
  afterEach(() => {
    delete globalThis.EventSource
    FakeEventSource.instances = []
  })

  it('runs catch-up on connect and dispatches typed updates', async () => {
    globalThis.EventSource = FakeEventSource
    const onUpdate = vi.fn()
    const onCatchUp = vi.fn(async () => {})
    const live = useSessionLive({ sessionUuid: 'session uuid', onUpdate, onCatchUp })

    live.start()
    const source = FakeEventSource.instances[0]
    expect(source.url).toBe('/api/sessions/session%20uuid/live')
    source.onopen()
    await vi.waitFor(() => expect(onCatchUp).toHaveBeenCalledOnce())
    source.emit('update', { journal: true, characterIds: [7] })

    expect(onUpdate).toHaveBeenCalledWith({ journal: true, characterIds: [7] })
    expect(live.status.value).toBe('connected')
    source.onerror()
    expect(live.status.value).toBe('error')
    live.stop()
    expect(source.closed).toBe(true)
  })
})
