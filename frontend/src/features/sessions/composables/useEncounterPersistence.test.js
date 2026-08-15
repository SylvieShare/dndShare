import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useEncounterPersistence } from './useEncounterPersistence'

async function settle() {
  for (let index = 0; index < 6; index += 1) await Promise.resolve()
}

describe('encounter persistence', () => {
  it('does not save before a successful hydration and snapshots debounced data', async () => {
    vi.useFakeTimers()
    const source = ref({ round: 0 })
    const save = vi.fn().mockResolvedValue(undefined)
    const persistence = useEncounterPersistence({ source, save, debounceMs: 500 })

    source.value.round = 1
    persistence.scheduleSave()
    await vi.advanceTimersByTimeAsync(500)
    expect(save).not.toHaveBeenCalled()

    persistence.markReady()
    persistence.scheduleSave()
    source.value.round = 2
    await vi.advanceTimersByTimeAsync(500)
    await settle()
    expect(save).toHaveBeenCalledWith({ round: 2 })
    vi.useRealTimers()
  })

  it('serializes writes so an older request cannot finish after a newer one', async () => {
    vi.useFakeTimers()
    const source = ref({ round: 1 })
    const releases = []
    const save = vi.fn(() => new Promise(resolve => releases.push(resolve)))
    const persistence = useEncounterPersistence({ source, save, debounceMs: 100 })
    persistence.markReady()

    persistence.scheduleSave()
    await vi.advanceTimersByTimeAsync(100)
    await settle()
    source.value.round = 2
    persistence.scheduleSave()
    await vi.advanceTimersByTimeAsync(100)
    await settle()
    expect(save).toHaveBeenCalledTimes(1)

    releases.shift()()
    await settle()
    expect(save).toHaveBeenCalledTimes(2)
    expect(save.mock.calls[1][0]).toEqual({ round: 2 })
    releases.shift()()
    await settle()
    vi.useRealTimers()
  })

  it('flushes pending changes when the owner unmounts', async () => {
    const source = ref({ active: true })
    const save = vi.fn().mockResolvedValue(undefined)
    const persistence = useEncounterPersistence({ source, save, debounceMs: 500 })
    persistence.markReady()
    persistence.scheduleSave()
    persistence.stop()
    await settle()
    expect(save).toHaveBeenCalledWith({ active: true })
  })
})
