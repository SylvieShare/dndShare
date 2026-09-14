import { abilityModifier, proficiencyBonus, resolveNumValue, sumBonuses } from '@/shared/lib/dnd'
import { SUGGEST16_TO_STAT } from '@/shared/lib/dndStats'

export function statusSaveBonus(ctx, abilityId) {
  const values = ctx.values || {}, stat = values[SUGGEST16_TO_STAT[abilityId]] || {}
  const context = { kind: 'saving_throw', abilitySuggestId: abilityId }
  const prof = values.prof_bonus?.auto === false ? Number(values.prof_bonus.v) || 0 : proficiencyBonus(values.lvl?.level)
  const up = stat.save_up || ctx.characterDerivedEffects?.saveProficiency?.(abilityId)?.rank > 0
  return abilityModifier(resolveNumValue(stat.value)) + (up ? prof + sumBonuses(values.prof_bonus?.bonuses) : 0) + sumBonuses(stat.save_bonuses) + (ctx.characterDerivedEffects?.bonus?.('save_bonus', context)?.total || 0)
}
export function statusDamageHp(hp = {}, total, defenses = [], damageType) {
  const kinds = new Set(defenses.filter(row => Number(row.damage_type) === Number(damageType)).map(row => row.kind))
  let amount = Math.max(0, total)
  if (kinds.has('immunity')) amount = 0
  else { if (kinds.has('resistance')) amount = Math.floor(amount / 2); if (kinds.has('vulnerability')) amount *= 2 }
  const temp = Math.max(0, Number(hp.temp) || 0), current = Math.max(0, Number(hp.current) || 0)
  return { ...hp, temp: Math.max(0, temp - amount), current: Math.max(0, current - Math.max(0, amount - temp)) }
}
export function ongoingDamageTransition(config, params, action, success = false) {
  const count = Math.max(0, Number(params.damage_dice ?? config.dice_count) || 0)
  const phase = params.damage_phase || 'initial_damage'
  if (action === 'damage' && ['initial_damage', 'turn_damage'].includes(phase)) return { ...params, damage_dice: count, damage_phase: phase === 'initial_damage' ? 'initial_save' : 'turn_save' }
  if (action === 'save' && ['initial_save', 'turn_save'].includes(phase)) {
    const next = success ? phase === 'initial_save' ? 0 : Math.max(0, count - (Number(config.decrease_on_save) || 1)) : count
    return next ? { ...params, damage_dice: next, damage_phase: 'turn_damage' } : null
  }
  return params
}
