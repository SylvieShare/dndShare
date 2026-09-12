import { computed, ref } from 'vue'
import { featuresForBinding } from '@/features/character-editor/settings/dnd/creation/progression'
import { choicesForEntry } from '@/features/items/lib/itemChoices'
import { applyLevelUpSpellSelection } from '../lib/levelUpSpellSelection'
import { abilitySelectionState, selectedAbilityEntries } from '@/features/character-editor/lib/selectedAbilities'

export function useLevelUpAbilitySelections({ values, classItem, entriesAfter, newTotal, pool, features, featureChoices, spellSelection }) {
  const plans = ref({})
  const revision = ref(0)
  const parents = computed(() => {
    const entry = entriesAfter.value.find(entry => entry.id === classItem.value?.id)
    if (!entry) return []
    return featuresForBinding(pool.value, { classId: entry.id, subclassId: entry.subclass?.id }, entry.level)
      .filter(item => item.data?.ability_selection)
  })
  const context = computed(() => {
    const abilities = [...(values()?.abilities_class || [])]
    for (const feature of features.value) {
      const entry = { id: feature.id, choices: choicesForEntry(feature, featureChoices.value) }
      const index = abilities.findIndex(existing => existing.id === entry.id)
      if (index < 0) abilities.push(entry)
      else abilities[index] = { ...abilities[index], ...entry }
    }
    return { ...values(), classes: entriesAfter.value, lvl: { ...values()?.lvl, level: newTotal.value },
      abilities_class: abilities, spells: applyLevelUpSpellSelection(values()?.spells, spellSelection.value),
    }
  })
  const catalogue = computed(() => [...new Map([...pool.value, ...Object.values(plans.value).flatMap(plan => plan.items || [])].map(item => [String(item.id), item])).values()])
  function replacements(parent) { return Math.max(0, Number(parent.data?.ability_selection?.replace_count) || 0) }
  const ready = computed(() => parents.value.every(parent => {
    const plan = plans.value[parent.id]
    return plan && abilitySelectionState(parent, context.value, catalogue.value, plan.entries,
      selectedAbilityEntries(values(), parent, catalogue.value), replacements(parent)).ready
  }))
  function change(plan) { plans.value = { ...plans.value, [plan.parentId]: plan } }
  function reset() { plans.value = {}; revision.value += 1 }
  return { parents, context, ready, change, reset, replacements, revision,
    selections: computed(() => parents.value.map(parent => ({ parent, entries: plans.value[parent.id]?.entries || [] }))), catalogue }
}
