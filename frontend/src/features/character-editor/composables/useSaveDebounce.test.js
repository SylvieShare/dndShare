import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useSaveDebounce } from './useSaveDebounce'
import { fetchPatch, fetchGet } from '@/shared/api/http'
vi.mock('@/shared/api/http', () => ({ fetchPatch: vi.fn(), fetchGet: vi.fn() }))
vi.mock('vue', async (original) => ({
  ...(await original()),
  onBeforeUnmount: vi.fn(),
}))

describe('versioned character autosave', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    setActivePinia(createPinia())
  })
  afterEach(() => vi.useRealTimers())
  it('does not save unchanged hydration and queues newer edits of the same field', async () => {
    const version = ref(7),
      data = ref({ values: { name: 'A' } })
    let complete
    fetchPatch
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            complete = resolve
          }),
      )
      .mockImplementationOnce(async (_, packet) => ({
        version: 9,
        patches: packet.patches,
      }))
    const save = useSaveDebounce('c', data, { version })
    save.scheduleSave()
    expect(fetchPatch).not.toHaveBeenCalled()
    data.value.values.name = 'B'
    save.scheduleSave()
    const flushed = save.flushSave()
    data.value.values.name = 'C'
    save.scheduleSave()
    complete({
      version: 8,
      patches: [{ op: 'set', path: ['values', 'name'], value: 'B' }],
    })
    expect(await flushed).toBe(true)
    expect(fetchPatch.mock.calls.map((call) => call[1].baseVersion)).toEqual([
      7, 8,
    ])
    expect(fetchPatch.mock.calls[1][1].patches).toEqual([
      { op: 'set', path: ['values', 'name'], value: 'C' },
    ])
    expect(version.value).toBe(9)
    expect(data.value.values.name).toBe('C')
    save.sync.stop()
  })
  it('keeps conflicting inventory changes blocked when the alert is dismissed', async () => {
    fetchPatch.mockRejectedValue(
      Object.assign(new Error('conflict'), { status: 409 }),
    )
    fetchGet.mockResolvedValue({
      version: 2,
      data: { values: { items: [{ uid: 'x', count: 3 }] } },
    })
    const version = ref(1),
      data = ref({ values: { items: [{ uid: 'x', count: 1 }] } })
    const save = useSaveDebounce('c', data, { version })
    data.value.values.items[0].count = 2
    save.scheduleSave()
    expect(await save.flushSave()).toBe(false)
    expect(save.saveError.value).toContain('Лист изменился')
    save.dismissSaveError()
    save.scheduleSave()
    expect(await save.flushSave()).toBe(false)
    expect(fetchPatch).toHaveBeenCalledOnce()
    expect(data.value.values.items[0].count).toBe(2)
    save.sync.stop()
  })
  it('sends health immediately and text after a short debounce; remote changes do not echo', async () => {
    fetchPatch.mockImplementation(async (_, packet) => ({
      version: packet.baseVersion + 1,
      patches: packet.patches,
    }))
    const data = ref({ values: { name: 'A', hp: { current: 10 } } }),
      version = ref(1)
    const save = useSaveDebounce('c', data, { version })
    data.value.values.hp.current = 9
    save.scheduleSave()
    expect(fetchPatch).toHaveBeenCalledOnce()
    await save.flushSave()
    await nextTick()
    data.value.values.name = 'B'
    save.scheduleSave()
    await vi.advanceTimersByTimeAsync(399)
    expect(fetchPatch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(fetchPatch).toHaveBeenCalledTimes(2)
    await save.flushSave()
    save.sync.receive({
      version: 4,
      data: { values: { name: 'B', hp: { current: 7 } } },
    })
    await nextTick()
    save.scheduleSave()
    await vi.advanceTimersByTimeAsync(500)
    expect(fetchPatch).toHaveBeenCalledTimes(2)
    save.sync.stop()
  })
})
it('uses the raw server baseline when the rendered sheet supplies missing defaults', async () => {
  setActivePinia(createPinia())
  const version = ref(0),
    serverDocument = ref(null),
    data = ref({ values: {}, var: {} })
  fetchPatch.mockImplementation(async (_, packet) => ({
    version: 2,
    patches: packet.patches,
  }))
  const save = useSaveDebounce('raw', data, { version, serverDocument })
  data.value = { values: { name: 'A' }, var: {} }
  serverDocument.value = { data: { values: { name: 'A' } }, version: 1 }
  version.value = 1
  data.value.var.stats = { ac: 12 }
  save.scheduleSave()
  await save.flushSave()
  expect(fetchPatch.mock.calls.at(-1)[1].patches).toEqual([
    { op: 'set', path: ['var'], value: { stats: { ac: 12 } } },
  ])
  save.sync.stop()
})
it('restores a pending packet after asynchronous hydration instead of clearing the outbox', async () => {
  setActivePinia(createPinia())
  const { useAccountStore } = await import('@/stores/account')
  useAccountStore().user = { id: 11 }
  const packet = {
    baseVersion: 1,
    mutationId: 'original-id',
    patches: [{ op: 'set', path: ['values', 'hp', 'current'], value: 9 }],
    metadata: [{ events: [{ type: 'hp_changed' }] }],
  }
  const saved = {
    base: { values: { hp: { current: 10 } } },
    version: 1,
    queue: [],
    flight: {
      packet,
      groups: [{ patches: packet.patches, metadata: packet.metadata[0] }],
    },
  }
  const storage = new Map([
    ['dndshare.document-pending.v1.character:11:async', JSON.stringify(saved)],
  ])
  vi.stubGlobal('localStorage', {
    getItem: (key) => storage.get(key),
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  })
  fetchPatch.mockImplementation(async (_, body) => ({
    version: 2,
    patches: body.patches,
  }))
  const version = ref(0),
    serverDocument = ref(null),
    data = ref({ values: {}, var: {} })
  const save = useSaveDebounce('async', data, { version, serverDocument })
  data.value = { values: { hp: { current: 9 } }, var: {} }
  serverDocument.value = {
    data: { values: { hp: { current: 9 } } },
    version: 2,
  }
  version.value = 2
  await save.sync.whenIdle()
  expect(fetchPatch.mock.calls.at(-1)[1]).toEqual(packet)
  expect(data.value.values.hp.current).toBe(9)
  expect(storage.size).toBe(0)
  save.sync.stop()
  vi.unstubAllGlobals()
})
