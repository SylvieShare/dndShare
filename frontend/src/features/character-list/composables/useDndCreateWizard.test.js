import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { effectScope, nextTick } from 'vue'
import { fetchGet } from '@/shared/api/http'
import { useSuggestStore } from '@/stores/suggest'
import { useDndCreateWizard } from './useDndCreateWizard'
import { createDndWizardState, DND_WIZARD_STORAGE_KEY, serializeDndWizardState } from './dndCreateWizardState'

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
  const storage = new Map()
  vi.stubGlobal('localStorage', {
    getItem: vi.fn(key => storage.get(key) ?? null),
    setItem: vi.fn((key, value) => storage.set(key, value)),
    removeItem: vi.fn(key => storage.delete(key)),
  })
  fetchGet.mockResolvedValue({ items: [] })
  setActivePinia(createPinia())
  const suggests = useSuggestStore()
  for (const id of [3, 4, 5, 6, 7, 15, 16]) suggests.set(id, [])
})

describe('D&D wizard draft restoration', () => {
  it.each(['race', 'subrace', 'raceVariant'])('still clears dependent choices when %s actually changes', async (field) => {
    const wizard = createWizard()
    wizard.state.race = { id: 1, data: {} }
    await nextTick()
    wizard.state.asiChoice = ['STR', 'CON']
    wizard.state.raceSkillIds = [201]
    wizard.state.raceLangIds = [21]
    wizard.state.featIds = [7]
    wizard.state.featSelections = { 7: { casting: ['INT'] } }

    wizard.state[field] = field === 'raceVariant' ? 'Даровитый' : { id: 2, data: {} }
    await nextTick()

    expect(wizard.state).toMatchObject({
      asiChoice: [], raceSkillIds: [], raceLangIds: [], featIds: [], featSelections: {},
    })
  })

  it.each(['2014', '2024'])('keeps all %s selections through catalogue loading and another reload', async (version) => {
    const race = { id: 1, name: 'Человек', data: { subraces: [{ id: 11 }], lang_choice: { count: 1 } } }
    const subrace = { id: 11, name: 'Происхождение', data: { race: 1 } }
    const saved = {
      ...createDndWizardState(), version, step: 5, name: 'Герой',
      race, subrace, charClass: { id: 2, name: 'Воин', data: {} },
      subclass: { id: 22, name: 'Архетип', data: {} },
      background: { id: 3, name: 'Предыстория', data: {} },
      asiChoice: ['STR', 'CON'], raceSkillIds: [201], raceLangIds: [21],
      featIds: [7], featSelections: { 7: { casting: ['INT'] } },
      skillIds: [202], classToolProficiencyIds: [301], spellIds: [401],
      choices: { 42: ['Вариант'] }, abilitySelections: { 43: { entries: [{ id: 44 }] } },
      bgLangIds: [19], backgroundItemChoices: { tool: 501 },
      scores: { STR: 15, DEX: 14, CON: 13, INT: 12, WIS: 10, CHA: 8 },
      classEquipmentChoices: { weapons: { optionId: 'sword', picks: { weapon: [601] } } },
      backgroundAsi: { STR: 2, CON: 1 }, originFeatId: 8, originFeatChoices: { skill: [203] },
    }
    saved.persona.backstory = 'История героя'
    localStorage.setItem(DND_WIZARD_STORAGE_KEY, JSON.stringify(saved))
    useSuggestStore().set(6, [{ id: 21, value: 'Общий' }, { id: 19, value: 'Эльфийский' }])
    fetchGet.mockImplementation(async (url) => {
      const typeId = Number(new URL(url, 'http://test').searchParams.get('typeId'))
      return { items: typeId === 8 ? [structuredClone(race)] : typeId === 16 ? [structuredClone(subrace)] : [] }
    })

    const wizard = createWizard()
    await wizard.load()
    await wizard.restore()
    await wizard.load()
    await nextTick()

    expect(serializeDndWizardState(wizard.state)).toEqual(saved)

    // A final edit is flushed when the page leaves, even before the debounce.
    wizard.state.name = 'Новое имя'
    scopes[0].stop()
    const reloaded = createWizard()
    await reloaded.load()
    await reloaded.restore()
    await reloaded.load()
    await nextTick()

    expect(serializeDndWizardState(reloaded.state)).toEqual({ ...saved, name: 'Новое имя' })
  })
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
