import { applyArmorMinimum } from '@/shared/lib/armorMinimum'
import { matchingDerivedEffects } from '@/features/character-editor/lib/characterDerivedEffects'

export function npcArmorClass(base, effects = []) {
  if (base == null || base === '' || !Number.isFinite(Number(base))) return null
  const total = Number(base) + matchingDerivedEffects(effects, 'armor_bonus').reduce((sum, rule) => sum + (Number(rule.value) || 0), 0)
  return applyArmorMinimum(total, matchingDerivedEffects(effects, 'armor_minimum')).total
}
