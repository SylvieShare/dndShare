export function unarmedStrikeAttackBonus(strengthModifier, proficiencyBonus) {
  return (Number(strengthModifier) || 0) + (Number(proficiencyBonus) || 0)
}

export function improvisedWeaponAttackBonus(strengthModifier) {
  return Number(strengthModifier) || 0
}

export function unarmedStrikeDamage(strengthModifier) {
  return Math.max(0, 1 + (Number(strengthModifier) || 0))
}

export function presetDamageExpression(kind, strengthModifier, critical = false) {
  const modifier = Number(strengthModifier) || 0
  if (kind === 'unarmed') return `${unarmedStrikeDamage(modifier)}{Дробящий}`
  const suffix = modifier === 0 ? '' : `${modifier > 0 ? '+' : ''}${modifier}{Дробящий}`
  return `${critical ? 2 : 1}d4{Дробящий}${suffix}`
}

