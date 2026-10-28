import { abilityModifier, resolveNumValue } from '@/shared/lib/dnd'

export function toolProficiencyRankFor(item, manuallyProficient, derivedRank) {
  const ids = Array.isArray(item?.data?.required_tool_proficiencies) ? item.data.required_tool_proficiencies : []
  return Math.max(manuallyProficient ? 1 : 0, ...ids.map(id => Number(derivedRank?.(id)) || 0))
}

export function toolCheckBonusFor(values, abilityKey, rank, proficiency, derivedBonus = 0) {
  return abilityModifier(resolveNumValue(values?.[abilityKey]?.value ?? 10)) + rank * proficiency + derivedBonus
}
