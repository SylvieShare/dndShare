import { damageAttackMode } from '@/shared/lib/weaponDamageOptions'

export const THROW_ACTION_KEY = 'weapon:throw'

export function isThrownWeapon(item, properties = []) {
  return [...(Array.isArray(item?.data?.tags) ? item.data.tags : []), ...properties].some(property => {
    const id = typeof property === 'object' ? property?.id : property
    const label = typeof property === 'object' ? property?.label || property?.value || '' : property
    return Number(id) === 6 || /метатель|thrown/i.test(String(label))
  })
}

export function withWeaponThrowAction(actions, item, properties = []) {
  const natural = isThrownWeapon(item, properties)
  const range = natural ? `${item?.data?.range_min ?? 20}/${item?.data?.range_max ?? 60}` : '20/60'
  const hint = natural ? `Метание с характеристикой оружия · ${range} фт.`
    : 'Импровизированное метание: Ловкость, без обычного бонуса владения · 20/60 фт. Тип урона уточните у мастера.'
  const modes = actions.filter(action => action.attack_mode === 'thrown')
  if (modes.length) return actions.map(action => action.attack_mode === 'thrown'
    ? { ...action, label: 'Метнуть', attack_condition: hint } : action)
  return [{ key: THROW_ACTION_KEY, label: 'Метнуть', attack_mode: 'thrown', condition: hint, attack_condition: hint,
    preview_replacement: natural ? null : { dice: 'd4', dice_count: 1 } }, ...actions]
}

/** Ephemeral roll state; the owned item and its normal attacks remain unchanged. */
export function prepareWeaponRollEntry(entry, item, properties, actions, actionKeys) {
  const mode = damageAttackMode(actions, actionKeys)
  const improvised = mode === 'thrown' && !isThrownWeapon(item, properties)
  return { ...entry, _attackMode: mode, _improvisedThrow: improvised,
    ...(improvised ? { stat_suggest_id: 2, add_attacks: [] } : {}) }
}
