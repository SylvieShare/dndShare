import { afterEach, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useEncounterPersistence } from './useEncounterPersistence'
afterEach(() => vi.useRealTimers())
it('waits for hydration and captures the newest debounced state as patches', async () => {
  vi.useFakeTimers()
  const source = ref({ round: 0 }),
    send = vi.fn(async (packet) => ({
      version: packet.baseVersion + 1,
      patches: packet.patches,
    }))
  const persistence = useEncounterPersistence({ source, send, debounceMs: 500 })
  source.value.round = 1
  persistence.scheduleSave()
  await vi.advanceTimersByTimeAsync(500)
  expect(send).not.toHaveBeenCalled()
  persistence.markReady({ data: { round: 1 }, version: 2 })
  source.value.round = 2
  persistence.scheduleSave()
  source.value.round = 3
  persistence.scheduleSave()
  await vi.advanceTimersByTimeAsync(500)
  expect(send.mock.calls[0][0]).toMatchObject({
    baseVersion: 2,
    patches: [
      { op: 'set', path: ['round'], value: 2 },
      { op: 'set', path: ['round'], value: 3 },
    ],
  })
  persistence.stop()
})
it('serializes changes while a previous request is in flight', async () => {
  vi.useFakeTimers()
  const source = ref({ round: 1 }),
    releases = []
  const send = vi.fn(
    (packet) =>
      new Promise((resolve) =>
        releases.push(() =>
          resolve({ version: packet.baseVersion + 1, patches: packet.patches }),
        ),
      ),
  )
  const persistence = useEncounterPersistence({ source, send, debounceMs: 100 })
  persistence.markReady({ data: { round: 0 }, version: 1 })
  persistence.scheduleSave()
  await vi.advanceTimersByTimeAsync(100)
  source.value.round = 2
  persistence.scheduleSave()
  await vi.advanceTimersByTimeAsync(100)
  expect(send).toHaveBeenCalledOnce()
  releases.shift()()
  await vi.advanceTimersByTimeAsync(0)
  expect(send).toHaveBeenCalledTimes(2)
  expect(send.mock.calls[1][0]).toMatchObject({
    baseVersion: 2,
    patches: [{ op: 'set', path: ['round'], value: 2 }],
  })
  releases.shift()()
  await vi.advanceTimersByTimeAsync(0)
  persistence.stop()
})
it('flushes an unsent change when unmounted', async () => {
  const source = ref({ active: false }),
    send = vi.fn(async (packet) => ({ version: 2, patches: packet.patches }))
  const persistence = useEncounterPersistence({ source, send, debounceMs: 500 })
  persistence.markReady({ data: { active: false }, version: 1 })
  source.value.active = true
  persistence.scheduleSave()
  persistence.stop()
  expect(send.mock.calls[0][0].patches).toEqual([
    { op: 'set', path: ['active'], value: true },
  ])
})
