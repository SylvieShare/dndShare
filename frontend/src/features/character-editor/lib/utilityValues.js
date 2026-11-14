import { abilityModByPath, proficiencyBonus, sumBonuses } from '@/shared/lib/dnd'
import { speedRuleContext, totalSpeed } from './characterDerivedEffects'

export function speedSummary(value, context = {}) {
  const data = value && typeof value === 'object' ? value : { base: 0, bonuses: [] }
  const armor = context.characterArmor?.state || {}
  const penalty = Number(armor.speedPenalty) || 0
  const derived = context.characterDerivedEffects?.speed?.(speedRuleContext(armor)) || { total: 0, sources: [] }
  return { data, armor, penalty, derived, total: totalSpeed(data, derived, penalty) }
}

export function initiativeSummary(value, values, context = {}, dexPath = 'values.DEX.mod') {
  const data = value && typeof value === 'object' ? value : { base: parseInt(value) || 0, bonuses: [] }
  const dexMod = abilityModByPath(values, dexPath)
  const dexExtra = data.use_dex && dexMod !== null ? dexMod : 0
  const derived = context.characterDerivedEffects?.bonus?.('check_bonus', {
    kind: 'initiative', abilitySuggestId: 2, proficient: false,
  })?.total || 0
  return { data, dexMod, dexExtra, derived, total: (Number(data.base) || 0) + sumBonuses(data.bonuses) + dexExtra + derived }
}

export function proficiencySummary(value, level) {
  const autoValue = proficiencyBonus(parseInt(level) || 1)
  const stored = !value || value.auto !== false
    ? { v: autoValue, auto: true, bonuses: value?.bonuses || [] }
    : { ...value, bonuses: value.bonuses || [] }
  return { autoValue, stored, total: (Number(stored.v) || 0) + sumBonuses(stored.bonuses) }
}
