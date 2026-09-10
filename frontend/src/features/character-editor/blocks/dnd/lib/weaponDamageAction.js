import { selectedDamageActions, weaponDamageActionFormula } from '@/shared/lib/weaponDamageOptions'

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
  const formula = weaponDamageActionFormula(action, critical)
  const extra = formula ? `${formula}${damageTypeLabel(damageType, damageTypeColor)}` : ''
  return [base, extra].filter(Boolean).join('+')
}

/** Combine independent extras once; the base weapon expression is already critical-aware. */
export function selectedWeaponDamageExpression({ baseExpression, actions = [], actionKeys = [], ...options }) {
  return selectedDamageActions(actions, actionKeys).reduce((base, action) =>
    weaponDamageActionExpression({ ...options, baseExpression: base, action }), baseExpression)
}
