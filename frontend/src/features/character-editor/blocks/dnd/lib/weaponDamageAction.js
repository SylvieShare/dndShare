function damageTypeLabel(type, color) {
  if (!type) return ''
  return color ? `{${type}|${color}}` : `{${type}}`
}

export function weaponDamageActionExpression({
  baseExpression,
  action,
  critical = false,
  damageType = '',
  damageTypeColor = '',
}) {
  const base = baseExpression && baseExpression !== '0' ? String(baseExpression) : ''
  const multiplier = critical && action?.double_on_critical !== false ? 2 : 1
  const count = Math.max(0, Number(action?.dice_count) || 0) * multiplier
  const die = String(action?.dice || '').trim()
  const extra = count > 0 && die
    ? `${count}${die}${damageTypeLabel(damageType, damageTypeColor)}`
    : ''
  return [base, extra].filter(Boolean).join('+')
}
