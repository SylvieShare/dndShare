import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useLevelUpAbilitySelections } from './useLevelUpAbilitySelections'
const parent = { id: 10, data: { level: 2, class_ids: [{ id: 1 }], ability_selection: { replace_count: 1, counts: [{ level: 2, count: 2 }, { level: 5, count: 3 }] } } }
const pact = { id: 20, data: { choices: [{ key: 'pact', count: 1, options: [{ value: 'blade', label: 'Клинок' }] }] } }
const options = [
  { id: 30, data: { level: 2, selection_parent_id: 10, selection_requirements: { spells: [{ id: 100 }] } } },
  { id: 31, data: { level: 3, selection_parent_id: 10, selection_requirements: { choices: [{ item_id: 20, key: 'pact', values: ['blade'] }] } } },
]
function setup() {
  const original = { lvl: { level: 2 }, classes: [{ id: 1, level: 2 }], abilities_class: [{ id: 10 }], spells: { tabs: [] } }
  const params = { values: () => original, classItem: ref({ id: 1 }), entriesAfter: ref([{ id: 1, level: 3 }]), newTotal: ref(3),
    pool: ref([parent, ...options]), features: ref([pact]), featureChoices: ref({}), spellSelection: ref(null) }
  return { params, state: useLevelUpAbilitySelections(params), original }
}
describe('level-up ability selections', () => {
  it('uses the pact and spell choices of the same level-up and revalidates changes', () => {
    const { state, params, original } = setup()
    state.change({ parentId: 10, entries: [{ id: 30 }, { id: 31 }], items: options })
    expect(state.ready.value).toBe(false)
    params.featureChoices.value = { 20: ['blade'] }
    params.spellSelection.value = { tab: { key: 'class:1', class_item_id: 1, mode: 'known' }, entries: [{ id: 100, level: 0 }] }
    expect(state.ready.value).toBe(true)
    expect(original.abilities_class).toEqual([{ id: 10 }])
    params.featureChoices.value = { 20: ['chain'] }
    expect(state.ready.value).toBe(false)
  })
  it('only offers selections for the class being advanced and clears drafts on reset', () => {
    const { state, params } = setup()
    expect(state.parents.value).toEqual([parent])
    params.classItem.value = { id: 2 }
    params.entriesAfter.value = [{ id: 1, level: 2 }, { id: 2, level: 3 }]
    expect(state.parents.value).toEqual([])
    expect(state.ready.value).toBe(true)
    state.reset()
    expect(state.selections.value).toEqual([])
  })
})
