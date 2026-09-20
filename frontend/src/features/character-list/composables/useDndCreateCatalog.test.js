import { describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive, ref } from 'vue'
import { useDndCreateCatalog } from './useDndCreateCatalog'
import { fetchGet } from '@/shared/api/http'
vi.mock('@/shared/api/http', () => ({ fetchGet: vi.fn() }))
vi.mock('@/shared/api/itemsApi', () => ({ itemsApi: { listAll: vi.fn(async () => ({ items: [] })) } }))

function setup(state, race, subraces) {
  fetchGet.mockImplementation(async url => ({ items: Number(new URL(url, 'http://test').searchParams.get('typeId')) === 8 ? [race]
    : Number(new URL(url, 'http://test').searchParams.get('typeId')) === 16 ? subraces : [] }))
  const scope = effectScope()
  const catalogue = scope.run(() => useDndCreateCatalog({ state, sourceVersionId: ref(1799), sourceSuffix: () => '', paused: () => false,
    equipment: { loadEquipmentCatalogue: async () => {}, ensureEquipmentCatalogueItems: async () => {} },
  }))
  return { catalogue, scope }
}
describe('current race catalogue in saved drafts', () => {
  it('replaces obsolete lineage variants with the current race and requires a subrace choice', async () => {
    const race = { id: 1, data: { description: 'Только общий текст', subraces: [{ id: 2 }] } }
    const state = reactive({ race: { id: 1, data: { variants: [{ value: 'Дроу' }] } }, subrace: null, raceVariant: 'Дроу', contentSources: {} })
    const { catalogue, scope } = setup(state, race, [{ id: 2, data: { race: 1 } }])
    await catalogue.load(); await nextTick()
    expect(state.race.data.description).toBe('Только общий текст')
    expect(state.raceVariant).toBeNull()
    expect(state.subrace).toBeNull()
    expect(catalogue.subraces.value.map(s => s.id)).toEqual([2])
    scope.stop()
  })
  it('keeps the selected subrace when refreshing the same race ID', async () => {
    const race = { id: 1, data: { subraces: [{ id: 2 }] } }
    const state = reactive({ race: { id: 1 }, subrace: { id: 2, data: { description: 'Старый текст' } }, raceVariant: null, contentSources: {} })
    const { catalogue, scope } = setup(state, race, [{ id: 2, data: { race: 1, description: 'Новый текст' } }])
    await catalogue.load(); await nextTick()
    expect(state.subrace?.id).toBe(2)
    expect(state.subrace?.data.description).toBe('Новый текст')
    scope.stop()
  })
})
