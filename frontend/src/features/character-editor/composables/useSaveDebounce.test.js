import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useSaveDebounce } from './useSaveDebounce'
import { fetchPut } from '@/shared/api/http'
vi.mock('@/shared/api/http', () => ({ fetchPut: vi.fn() }))
vi.mock('vue', async importOriginal => ({ ...await importOriginal(), onBeforeUnmount: vi.fn() }))

describe('serialized character saves before item transfers', () => {
  beforeEach(() => { vi.clearAllMocks() })
  it('waits for an active save and sends later changes against the returned revision', async () => {
    const version = ref(7), data = ref({ values: { name: 'A' } })
    let complete
    fetchPut.mockImplementationOnce(() => new Promise(resolve => { complete = resolve }))
      .mockResolvedValueOnce({ version: 9 })
    const save = useSaveDebounce('c', data, { version })
    save.scheduleSave()
    const flushed = save.flushSave()
    data.value = { values: { name: 'B' } }
    save.scheduleSave()
    complete({ version: 8 })
    expect(await flushed).toBe(true)
    expect(fetchPut.mock.calls.map(call => call[1].version)).toEqual([7, 8])
    expect(version.value).toBe(9)
    expect(save.saveStatus.value).toBe('idle')
  })
  it('keeps a stale inventory draft protected even after the error is dismissed', async () => {
    fetchPut.mockRejectedValue(Object.assign(new Error('conflict'), { status: 409 }))
    const version = ref(1), data = ref({ values: { items: { sections: [] } } })
    const restoreEvents = vi.fn(), events = [{ type: 'item_spent' }]
    const save = useSaveDebounce('c', data, { version, takeEvents: () => events, restoreEvents })
    save.scheduleSave()
    expect(await save.flushSave()).toBe(false)
    expect(restoreEvents).toHaveBeenCalledWith(events)
    expect(save.saveError.value).toContain('Лист изменился')
    save.dismissSaveError()
    save.scheduleSave()
    expect(await save.flushSave()).toBe(false)
    expect(save.saveStatus.value).toBe('error')
    expect(fetchPut).toHaveBeenCalledTimes(1)
    expect(version.value).toBe(1)
  })
})
