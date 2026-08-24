export const PRESET_ATTACK_ART_ITEM_IDS = Object.freeze({
  unarmed: 64,
  improvised: 35,
})

export function unarmedStrikeAttackBonus(strengthModifier, proficiencyBonus) {
  return (Number(strengthModifier) || 0) + (Number(proficiencyBonus) || 0)
}

export function improvisedWeaponAttackBonus(strengthModifier) {
  return Number(strengthModifier) || 0
}

export function unarmedStrikeDamage(strengthModifier, damageBonus = 0) {
  return Math.max(0, 1 + (Number(strengthModifier) || 0) + (Number(damageBonus) || 0))
}

export function presetDamageExpression(kind, strengthModifier, critical = false, damageBonus = 0) {
  const modifier = (Number(strengthModifier) || 0) + (Number(damageBonus) || 0)
  if (kind === 'unarmed') return `${unarmedStrikeDamage(strengthModifier, damageBonus)}{Дробящий}`
  const suffix = modifier === 0 ? '' : `${modifier > 0 ? '+' : ''}${modifier}{Дробящий}`
  return `${critical ? 2 : 1}d4{Дробящий}${suffix}`
}
