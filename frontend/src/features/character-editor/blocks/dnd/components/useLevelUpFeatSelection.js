import { computed, ref } from 'vue'
import {
  abilityScoresFromValues,
  evaluateFeatEligibility,
  featChoices,
} from '@/features/items/lib/featRules'
import { actionableItemChoices } from '@/features/items/lib/itemChoices'

export function useLevelUpFeatSelection({ values, entries, itemsById, newTotal, suggestStore }) {
  const featPick = ref(null)
  const featPickerOpen = ref(false)
  const featConfigItem = ref(null)

  const ruleContext = computed(() => {
    const currentValues = values()
    const armorLabels = [
      ...(Array.isArray(currentValues?.proficiencies?.['Доспехи']) ? currentValues.proficiencies['Доспехи'] : []),
      ...(Array.isArray(currentValues?.proficiencies_armor) ? currentValues.proficiencies_armor : []),
    ]
    const armorProfIds = (suggestStore.items(3) || [])
      .filter((entry) => armorLabels.some((label) => String(label).toLowerCase() === String(entry.value).toLowerCase()))
      .map((entry) => entry.id)
    for (const entry of entries.value) {
      for (const id of (itemsById.value[entry.id]?.data?.armor_prof || [])) {
        if (!armorProfIds.includes(id)) armorProfIds.push(id)
      }
    }
    return {
      stats: abilityScoresFromValues(currentValues),
      level: newTotal.value,
      spellcasting: !!currentValues?.spells
        || entries.value.some((entry) => !!itemsById.value[entry.id]?.data?.spellcasting),
      armorProfIds,
    }
  })

  const excludedChoices = computed(() => {
    const item = featConfigItem.value
    if (!item?.data?.repeatable) return {}
    const uniqueKeys = new Set([
      item.data.unique_choice_key,
      ...featChoices(item).filter((choice) => choice.unique_across_takes).map((choice) => choice.key),
    ].filter(Boolean))
    const result = {}
    for (const entry of (values()?.abilities_feats || []).filter((feat) => feat.id === item.id)) {
      for (const key of uniqueKeys) {
        result[key] = [...(result[key] || []), ...(entry.choices?.[key] || [])]
      }
    }
    return result
  })

  function eligibility(item) {
    const result = evaluateFeatEligibility(item, ruleContext.value)
    const alreadyTaken = (values()?.abilities_feats || []).some((entry) => entry.id === item.id)
    if (alreadyTaken && !item.data?.repeatable) {
      return { ...result, eligible: false, reasons: [...result.reasons, 'Черта уже выбрана'] }
    }
    return result
  }

  function pick(item) {
    if (item?.id == null) return
    featPickerOpen.value = false
    if (actionableItemChoices(item).length) featConfigItem.value = item
    else featPick.value = { ...item, selectedChoices: {} }
  }

  function confirmChoices(choices) {
    featPick.value = { ...featConfigItem.value, selectedChoices: choices }
    featConfigItem.value = null
  }

  return {
    featPick,
    featPickerOpen,
    featConfigItem,
    featExcludedChoices: excludedChoices,
    featEligibility: eligibility,
    onFeatPick: pick,
    onFeatChoicesConfirm: confirmChoices,
  }
}
