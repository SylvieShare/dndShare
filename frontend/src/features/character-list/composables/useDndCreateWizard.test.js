import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { effectScope, nextTick } from 'vue'
import { fetchGet } from '@/shared/api/http'
import { useSuggestStore } from '@/stores/suggest'
import { useDndCreateWizard } from './useDndCreateWizard'

vi.mock('@/shared/api/http', () => ({ fetchGet: vi.fn() }))
vi.mock('@/shared/api/itemsApi', () => ({ itemsApi: { listAll: vi.fn(async () => ({ items: [] })) } }))

const scopes = []

function createWizard() {
  const scope = effectScope()
  scopes.push(scope)
  return scope.run(() => useDndCreateWizard())
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('localStorage', { setItem: vi.fn(), removeItem: vi.fn() })
  fetchGet.mockResolvedValue({ items: [] })
  setActivePinia(createPinia())
  const suggests = useSuggestStore()
  for (const id of [3, 4, 5, 6, 7, 15, 16]) suggests.set(id, [])
})

afterEach(() => {
  scopes.splice(0).forEach(scope => scope.stop())
  vi.unstubAllGlobals()
})

describe('D&D wizard payload assembly', () => {
  it.each(['2014', '2024'])('builds a %s character without granted spells', async (version) => {
    const wizard = createWizard()
    wizard.state.version = version
    await nextTick()
    wizard.state.name = '  Воин  '
    wizard.state.race = { id: 1, name: 'Человек', data: {} }
    wizard.state.charClass = { id: 2, name: 'Воин', data: {} }
    wizard.quickBuild()
    await nextTick()

    const payload = wizard.buildPayload()

    expect(payload.name).toBe('Воин')
    expect(payload.data.values).not.toHaveProperty('spells')
  })

  it('builds an incomplete draft for preview and partial creation', () => {
    const payload = createWizard().buildPayload()

    expect(payload.data.values).toBeDefined()
    expect(payload.data.values).not.toHaveProperty('spells')
  })

  it('includes current level-one class and subclass grants and updates them when the subclass changes', async () => {
    const wizard = createWizard()
    wizard.state.charClass = {
      id: 2, name: 'Жрец', data: {
        spellcasting: { ability: 5, prepares: true },
        granted_spells: [{ spell: 100, level: 1 }],
      },
    }
    await nextTick()
    wizard.state.subclass = {
      id: 3, name: 'Домен жизни', data: {
        granted_spells: [
          { spell: 100, level: 1 },
          { spell: { id: 101 }, level: 1 },
          { spell: 102, level: 3 },
        ],
      },
    }
    await nextTick()

    const spells = wizard.buildPayload().data.values.spells

    expect(spells.grants).toMatchObject([
      { id: 100, tab_key: 'class:2', source: { item_id: 3 } },
      { id: 101, tab_key: 'class:2', source: { item_id: 3 } },
    ])
    expect(spells.tabs[0].spells).toEqual([])

    wizard.state.subclass = null
    await nextTick()

    expect(wizard.buildPayload().data.values.spells.grants).toMatchObject([
      { id: 100, source: { item_id: 2 } },
    ])
  })
})
