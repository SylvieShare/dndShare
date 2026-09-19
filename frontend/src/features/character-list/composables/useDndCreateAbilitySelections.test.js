import { describe, it, expect } from 'vitest'
import { effectScope, nextTick, reactive, ref } from 'vue'
import { useDndCreateAbilitySelections } from './useDndCreateAbilitySelections'

describe('class abilities at creation', () => {
  it('requires a complete invocation choice and clears it on class change', async () => {
    const state = reactive({ charClass: { id: 9 }, spellIds: [], abilitySelections: {} })
    const parent = { id: 10, data: { level: 1, level_source: 'class', level_class_id: 9, class_ids: [{ id: 9 }], ability_selection: { counts: [{ level: 1, count: 1 }] } } }
    const option = { id: 11, data: { level: 1, selection_parent_id: 10 } }
    const scope = effectScope()
    const selections = scope.run(() => useDndCreateAbilitySelections(state, ref([parent, option]), () => false))
    expect(selections.abilitySelectionParents.value.map(item => item.id)).toEqual([10])
    expect(selections.abilitySelectionsComplete.value).toBe(false)
    selections.setAbilitySelection({ parentId: 10, entries: [{ id: 11 }] })
    expect(selections.abilitySelectionsComplete.value).toBe(true)
    state.charClass = { id: 20 }
    await nextTick()
    expect(state.abilitySelections).toEqual({})
    scope.stop()
  })
})
