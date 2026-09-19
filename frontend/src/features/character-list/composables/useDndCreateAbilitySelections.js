import { computed, watch } from 'vue'
import { featuresForBinding } from '@/features/character-editor/settings/dnd/creation/progression'
import { abilitySelectionState } from '@/features/character-editor/lib/selectedAbilities'

export function useDndCreateAbilitySelections(state, items, paused) {
  const parents = computed(() => featuresForBinding(items.value, { classId: state.charClass?.id, subclassId: state.subclass?.id }, 1).filter(item => item.data?.ability_selection))
  const values = computed(() => ({
    classes: [{ id: state.charClass?.id, level: 1 }],
    abilities_class: Object.values(state.abilitySelections || {}).flatMap(plan => plan.entries || []),
    spells: { tabs: [{ spells: (state.spellIds || []).map(id => ({ id })) }] },
  }))
  const ready = computed(() => parents.value.every(parent => abilitySelectionState(parent, values.value, items.value, state.abilitySelections?.[parent.id]?.entries || [], [], 0).ready))
  function change(plan) { state.abilitySelections = { ...state.abilitySelections, [plan.parentId]: { entries: plan.entries } } }
  watch(() => state.charClass?.id, () => { if (!paused()) state.abilitySelections = {} })
  return { abilitySelectionParents: parents, abilitySelectionValues: values, abilitySelectionsComplete: ready, setAbilitySelection: change }
}
