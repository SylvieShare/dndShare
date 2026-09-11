import { weaponUseState } from './weaponUses'

const prefix = 'weapon-use:'
/** Paid hit steps are ordinary menu additions, backed by the pending instance event. */
export function weaponUseDamageActions(values, uid) {
  const event = weaponUseState(values, uid)
  if (event?.status !== 'active') return []
  return event.steps.filter(step => step.kind === 'weapon_damage' && step.status === 'pending').map(step => ({
    key: `${prefix}${event.id}:${step.key}`, label: step.title,
    dice: step.dice, dice_count: step.dice_count, damage_type: step.damage_type,
    double_on_critical: true,
    condition: [event.title, ...(step.requirements || [])].join(' · '),
    prepaid: { eventId: event.id, stepKey: step.key, attackMode: event.attack_mode,
      expression: step.expression, criticalExpression: step.critical_expression },
  }))
}
export function weaponUseDamageSelection(values, uid, keys) {
  const requested = keys.filter(key => key.startsWith(prefix))
  if (!requested.length) return {}
  if (requested.length > 1) return { error: 'Выберите урон только по одной цели применения.' }
  const action = weaponUseDamageActions(values, uid).find(row => row.key === requested[0])
  return action ? { action } : { error: 'Этот дополнительный урон уже использован или применение завершено.' }
}
