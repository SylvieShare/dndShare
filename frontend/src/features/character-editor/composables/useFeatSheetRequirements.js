import { computed, watch } from 'vue'
import { collectCharacterDerivedEffects, derivedGrantedProficiencies } from '../lib/characterDerivedEffects'

import { abilityScoresFromValues, evaluateFeatEligibility } from '@/features/items/lib/featRules'

export function useFeatSheetRequirements({
  isFeatBlock,
  values,
  entries,
  catalog,
  armorDictionary,
  sheetGrants,
  onActivate,
  onDeactivate,
  onChange,
}) {
  const grantedArmor = computed(() => {
    const grants = sheetGrants?.()
    if (grants) return grants.map(row => row.targetId)
    const items = new Map(catalog().map(item => [String(item.id), item]))
    return derivedGrantedProficiencies(collectCharacterDerivedEffects(values(), items), 'armor_proficiency').map(row => row.targetId)
  })
  function eligibility(item) {
    const currentValues = values()
    const armorLabels = currentValues?.proficiencies?.['Доспехи'] || []
    const armorProfIds = armorDictionary()
      .filter((row) => armorLabels.some((label) => String(label).toLowerCase() === String(row.value).toLowerCase()))
      .map((row) => row.id)
    armorProfIds.push(...grantedArmor.value)
    return evaluateFeatEligibility(item, {
      stats: abilityScoresFromValues(currentValues),
      level: currentValues?.lvl?.level,
      spellcasting: !!currentValues?.spells,
      armorProfIds,
    })
  }

  function requirementsMet(item) {
    return !isFeatBlock() || eligibility(item).eligible
  }

  function sync() {
    if (!isFeatBlock() || !catalog().length) return
    let changed = false
    const next = entries().map((entry) => {
      const item = catalog().find((candidate) => String(candidate.id) === String(entry.id))
      if (!item) return entry
      const met = requirementsMet(item)
      const wasMet = entry.requirements_met !== false
      if (met === wasMet) return entry
      changed = true
      if (met) {
        onActivate(item, entry)
        const activeEntry = { ...entry }
        delete activeEntry.requirements_met
        return activeEntry
      }
      onDeactivate(item, entry)
      return { ...entry, requirements_met: false }
    })
    if (changed) onChange(next)
  }

  watch(() => JSON.stringify({
    stats: ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].map((key) => values()?.[key]?.value),
    armor: values()?.proficiencies?.['Доспехи'],
    grants: grantedArmor.value,
    spells: !!values()?.spells,
    entries: entries().map((entry) => [entry.id, entry.requirements_met, entry.choices]),
    catalogSize: catalog().length,
  }), sync)

  return { eligibility, requirementsMet, sync }
}
