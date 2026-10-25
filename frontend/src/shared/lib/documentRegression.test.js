import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { effectScope, nextTick, ref } from 'vue'
import { createDocumentSync } from '@/shared/lib/documentSync'
import { copyDocument, documentDiff } from '@/shared/lib/documentPatch'
import { useSaveDebounce } from '@/features/character-editor/composables/useSaveDebounce'
import { useEncounterPersistence } from '@/features/sessions/composables/useEncounterPersistence'
import { useDndCreateWizard } from '@/features/character-list/composables/useDndCreateWizard'
import { createDndWizardState, DND_WIZARD_STORAGE_KEY } from '@/features/character-list/composables/dndCreateWizardState'
import { useAccountStore } from '@/stores/account'
import { useSuggestStore } from '@/stores/suggest'
import { fetchGet, fetchPatch } from '@/shared/api/http'
import { itemsApi } from '@/shared/api/itemsApi'

vi.mock('@/shared/api/http', () => ({ fetchGet: vi.fn(), fetchPatch: vi.fn() }))
vi.mock('@/shared/api/itemsApi', () => ({ itemsApi: { listAll: vi.fn() } }))
vi.mock('vue', async original => ({ ...(await original()), onBeforeUnmount: vi.fn() }))

let storage
const dispose = []
beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  storage = new Map()
  vi.stubGlobal('localStorage', {
    get length() { return storage.size },
    key: index => [...storage.keys()][index] ?? null,
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  })
  setActivePinia(createPinia())
  useAccountStore().user = { id: 17 }
  for (const type of [3, 4, 5, 6, 7, 15, 16]) useSuggestStore().set(type, [])
  fetchGet.mockResolvedValue({ items: [] })
  itemsApi.listAll.mockReset().mockResolvedValue({ items: [] })
})
afterEach(() => {
  dispose.splice(0).forEach(fn => fn())
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
function wizard() {
  const scope = effectScope()
  dispose.push(() => scope.stop())
  return scope.run(() => useDndCreateWizard())
}
function sync(options) {
  const value = createDocumentSync(options)
  dispose.push(() => value.stop())
  return value
}

it('one tab acknowledgement must not erase another tab pending changes', async () => {
  let release
  const tabA = sync({
    data: { a: 0, b: 0 }, version: 1, storageKey: 'same-document',
    send: packet => new Promise(resolve => { release = () => resolve({ version: 2, patches: packet.patches }) }),
  })
  const tabB = sync({ data: { a: 0, b: 0 }, version: 1, storageKey: 'same-document' })
  await Promise.all([tabA.ready, tabB.ready])
  tabA.edit({ a: 1, b: 0 })
  const saving = tabA.flush()
  tabB.edit({ a: 0, b: 1 })
  expect(tabB.pending).toBe(true)
  expect(storage.size).toBe(2)
  release()
  await saving
  expect(storage.size).toBe(1)
  tabB.stop()
  const reopenedB = sync({ data: { a: 1, b: 0 }, version: 2, storageKey: 'same-document' })
  await reopenedB.ready
  expect(reopenedB.data.b).toBe(1)
})

it('catch-up must not reapply collection operations already acknowledged while its GET was pending', async () => {
  let release
  const controller = sync({
    data: { items: [] }, version: 1,
    send: async packet => ({ version: 2, patches: packet.patches }),
    load: () => new Promise(resolve => { release = resolve }),
  })
  const catchingUp = controller.catchUp()
  const handled = catchingUp.then(() => null, error => error)
  controller.edit({ items: [{ id: 'new', count: 1 }] })
  await controller.flush()
  release({ fromVersion: 1, version: 2, patches: [{
    op: 'insert', path: ['items', { idField: 'id', id: 'new' }], value: { id: 'new', count: 1 },
  }] })
  expect(await handled).toBeNull()
})

it('opening an already seeded sheet must resume its restored pending packet', async () => {
  const base = { values: { name: 'Старое имя' } }
  const patches = [{ op: 'set', path: ['values', 'name'], value: 'Правка' }]
  storage.set('dndshare.document-pending.v1.character:17:seeded', JSON.stringify({
    base, version: 1, queue: [], flight: {
      groups: [{ patches, metadata: {} }],
      packet: { baseVersion: 1, mutationId: 'saved-packet', patches, metadata: [{}] },
    },
  }))
  fetchPatch.mockImplementation(async (_url, packet) => ({ version: 2, patches: packet.patches }))
  const data = ref(copyDocument(base))
  const save = useSaveDebounce('seeded', data, {
    version: ref(1), serverDocument: ref({ data: base, version: 1 }), canSave: () => true,
  })
  dispose.push(() => save.sync.stop())
  await save.sync.ready
  expect(data.value.values.name).toBe('Правка')
  await nextTick()
  await vi.advanceTimersByTimeAsync(2000)
  expect(fetchPatch).toHaveBeenCalledOnce()
})

it('waits for late edit permissions before recovering and sending a seeded sheet queue', async () => {
  const base = { values: { name: 'Старое имя' } }
  storage.set('dndshare.document-pending.v1.character:17:late-auth', JSON.stringify({
    base, version: 1, queue: [{ patches: [{ op: 'set', path: ['values', 'name'], value: 'Правка' }], metadata: {} }], flight: null,
  }))
  const allowed = ref(false)
  fetchPatch.mockImplementation(async (_url, packet) => ({ version: 2, patches: packet.patches }))
  const save = useSaveDebounce('late-auth', ref(base), {
    version: ref(1), serverDocument: ref({ data: base, version: 1 }), canSave: () => allowed.value,
  })
  dispose.push(() => save.sync.stop())
  await vi.advanceTimersByTimeAsync(1000)
  expect(fetchPatch).not.toHaveBeenCalled()
  allowed.value = true
  await save.sync.whenIdle()
  expect(fetchPatch).toHaveBeenCalledOnce()
})

it('closing encounter while saving must drain edits queued after the first request', async () => {
  let release
  const source = ref({ round: 0 })
  const send = vi.fn(async packet => {
    if (packet.baseVersion === 1) await new Promise(resolve => { release = resolve })
    return { version: packet.baseVersion + 1, patches: packet.patches }
  })
  const persistence = useEncounterPersistence({ source, send, debounceMs: 400, storageKey: 'encounter' })
  await persistence.markReady({ data: { round: 0 }, version: 1 })
  source.value.round = 1
  persistence.scheduleSave()
  const saving = persistence.flushSave()
  source.value.round = 2
  persistence.scheduleSave()
  persistence.stop()
  release()
  await saving
  expect(send).toHaveBeenCalledTimes(2)
})

it('a failed spell request during restoration must not permanently disable draft persistence', async () => {
  const saved = { ...createDndWizardState(), name: 'До загрузки', charClass: {
    id: 1, name: 'Жрец', data: { spellcasting: { ability: 5, prepares: true } },
  } }
  storage.set(DND_WIZARD_STORAGE_KEY, JSON.stringify(saved))
  itemsApi.listAll.mockRejectedValueOnce(new Error('offline'))
  const controller = wizard()
  await expect(controller.restore()).rejects.toThrow('offline')
  controller.state.name = 'Правка после ошибки'
  await vi.advanceTimersByTimeAsync(2000)
  expect(JSON.parse(storage.get(DND_WIZARD_STORAGE_KEY)).name).toBe('Правка после ошибки')
})

it('a supported 4096-tile bulk rotation must not create a packet above the 10000-operation limit', async () => {
  const tiles = Array.from({ length: 4096 }, (_, i) => ({ id: String(i), x: i % 64, y: Math.floor(i / 64), rotation: 0 }))
  const before = { document: { tiles } }
  const after = { document: { tiles: tiles.map(tile => ({ ...tile, x: 63 - tile.y, y: tile.x, rotation: 90 })) } }
  expect(documentDiff(before, after).length).toBeLessThanOrEqual(10000)
  const packets = []
  const controller = sync({ data: before, version: 1, send: async packet => {
    packets.push(packet)
    if (packet.patches.length > 10000) throw Object.assign(new Error('Некорректный пакет изменений'), { status: 400 })
    return { version: packet.baseVersion + 1, patches: packet.patches }
  } })
  controller.edit(after)
  await controller.flush()
  expect(packets[0].patches.length).toBeLessThanOrEqual(10000)
})

it('restoring a draft must refresh its selected class from the current catalogue', async () => {
  const oldClass = { id: 2, name: 'Воин', data: { hit_die: 6 } }
  const currentClass = { id: 2, name: 'Воин', data: { hit_die: 10 } }
  storage.set(DND_WIZARD_STORAGE_KEY, JSON.stringify({ ...createDndWizardState(), charClass: oldClass }))
  fetchGet.mockImplementation(async url => ({
    items: new URL(url, 'http://test').searchParams.get('typeId') === '9' ? [currentClass] : [],
  }))
  const controller = wizard()
  await controller.load()
  await controller.restore()
  await controller.load()
  expect(controller.state.charClass.data.hit_die).toBe(10)
})
