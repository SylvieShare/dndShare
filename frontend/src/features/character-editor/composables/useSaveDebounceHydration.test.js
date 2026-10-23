import { afterEach, expect, it, vi } from 'vitest'
import { onBeforeUnmount, ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useSaveDebounce } from './useSaveDebounce'
import { fetchPatch } from '@/shared/api/http'

vi.mock('@/shared/api/http', () => ({ fetchPatch: vi.fn(), fetchGet: vi.fn() }))
vi.mock('vue', async (original) => ({
  ...(await original()),
  onBeforeUnmount: vi.fn(),
}))
afterEach(() => vi.clearAllMocks())

it.each([3, 4])(
  'keeps saving after live version 4 arrives before the initial GET at version %s',
  async (restVersion) => {
    setActivePinia(createPinia())
    const version = ref(0),
      serverDocument = ref(null),
      data = ref({ values: {}, var: {} })
    const save = useSaveDebounce('live', data, { version, serverDocument })
    save.sync.receive({
      version: 4,
      data: { values: { name: 'Актуальное имя', hp: { current: 8 } } },
    })
    // useCharacterData.apply receives the HTTP response after the live roster.
    data.value = {
      values: {
        name: restVersion === 4 ? 'Актуальное имя' : 'Старое имя',
        hp: { current: 8 },
      },
      var: {},
    }
    serverDocument.value = {
      data: JSON.parse(JSON.stringify(data.value)),
      version: restVersion,
    }
    version.value = restVersion
    expect(data.value.values.name).toBe('Актуальное имя')
    expect(version.value).toBe(4)
    fetchPatch.mockImplementation(async (_, packet) => ({
      version: packet.baseVersion + 1,
      patches: packet.patches,
    }))
    data.value.values.name = 'Правка'
    save.scheduleSave()
    try {
      expect(await save.flushSave()).toBe(true)
      expect(fetchPatch).toHaveBeenCalledOnce()
      expect(fetchPatch.mock.calls[0][1]).toMatchObject({
        baseVersion: 4,
        patches: [{ op: 'set', path: ['values', 'name'], value: 'Правка' }],
      })
    } finally {
      save.sync.stop()
    }
  },
)

it('initializes from a loaded version zero instead of silently ignoring every edit', async () => {
  setActivePinia(createPinia())
  const version = ref(0),
    serverDocument = ref(null),
    data = ref({ values: {}, var: {} })
  const save = useSaveDebounce('zero', data, { version, serverDocument })
  data.value = { values: { name: 'Имя' }, var: {} }
  serverDocument.value = { data: { values: { name: 'Имя' } }, version: 0 }
  fetchPatch.mockImplementation(async (_, packet) => ({
    version: 1,
    patches: packet.patches,
  }))
  data.value.values.name = 'Правка'
  save.scheduleSave()
  try {
    expect(await save.flushSave()).toBe(true)
    expect(fetchPatch).toHaveBeenCalledOnce()
    expect(fetchPatch.mock.calls[0][1].baseVersion).toBe(0)
  } finally {
    save.sync.stop()
  }
})

it('drains later edits after closing a sheet with an outstanding save', async () => {
  setActivePinia(createPinia())
  const version = ref(1),
    data = ref({ values: { name: 'Имя' } })
  let release
  fetchPatch.mockImplementation(async (_, packet) => {
    if (packet.baseVersion === 1)
      await new Promise((resolve) => {
        release = resolve
      })
    return { version: packet.baseVersion + 1, patches: packet.patches }
  })
  const save = useSaveDebounce('close', data, { version })
  data.value.values.name = 'Первая правка'
  save.scheduleSave()
  const saving = save.flushSave()
  data.value.values.name = 'Последняя правка'
  save.scheduleSave()
  vi.mocked(onBeforeUnmount).mock.calls.at(-1)[0]()
  release()
  try {
    await vi.waitFor(() => expect(fetchPatch).toHaveBeenCalledTimes(2))
    expect(await saving).toBe(true)
    expect(fetchPatch.mock.calls[1][1]).toMatchObject({
      baseVersion: 2,
      patches: [
        { op: 'set', path: ['values', 'name'], value: 'Последняя правка' },
      ],
    })
  } finally {
    save.sync.stop()
  }
})
