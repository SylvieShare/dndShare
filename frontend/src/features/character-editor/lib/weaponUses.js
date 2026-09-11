import { inventoryEntries, magicItemActive, mapOwnedEntries, MAGIC_VALUE_ID } from './characterMagicItems'
import { collectCharacterResources, setCharacterResourceAvailable } from './characterResources'
import { weaponDamageActionExpression } from '../blocks/dnd/lib/weaponDamageAction'

const int = (v, min, max) => Number.isInteger(Number(v)) && Number(v) >= min && Number(v) <= max
export function weaponUseError(rule) {
  if (!rule?.key || !rule.title?.trim()) return 'Укажите название и ключ особого применения.'
  if (!['thrown', 'melee', 'ranged'].includes(rule.attack_mode)) return 'Выберите способ атаки.'
  if (rule.attack_mode !== 'melee' && !int(rule.range_ft, 1, 10000)) return 'Укажите дистанцию атаки в футах.'
  if (!int(rule.resource_cost, 0, 100)) return 'Стоимость применения должна быть целым числом от 0 до 100.'
  if (!Array.isArray(rule.steps) || !rule.steps.length) return 'Добавьте хотя бы один шаг после атаки.'
  const keys = new Set()
  for (const step of rule.steps) {
    if (!step.key || keys.has(step.key) || !step.title?.trim()) return 'У каждого шага должны быть название и уникальный ключ.'
    keys.add(step.key)
    if (!['damage', 'weapon_damage'].includes(step.kind)) return 'Выберите вид урона шага.'
    if (!/^d(4|6|8|10|12|20|100)$/.test(step.dice || '') || !int(step.dice_count, 1, 100)) return 'Укажите кости урона шага.'
    if (step.damage_type == null) return 'Выберите тип урона шага.'
    if (step.save && (step.kind !== 'damage' || !int(step.save.ability, 1, 6) || !int(step.save.dc, 1, 99))) return 'Укажите характеристику и Сл спасброска для отдельного урона.'
    if (step.area && !int(rule.range_ft, 1, 10000)) return 'Укажите длину линии в дистанции применения.'
    if (step.area && (step.kind !== 'damage' || step.area.shape !== 'line' || !int(step.area.width_ft, 1, 1000))) return 'Укажите ширину линии для отдельного урона.'
  }
  return ''
}

export function availableWeaponUses(values, items, uid, owner = true) {
  const owned = inventoryEntries(values).find(row => row.entry.uid === uid)
  const item = items.get(String(owned?.entry.magic_item_id ?? owned?.entry.item_id))
  if (!owned || !magicItemActive(item, owned.entry, owned.equipped, values)) return []
  const resources = collectCharacterResources(values, items)
  return (item.data.weapon_uses || []).map(rule => {
    const resource = resources.find(row => row.source?.valueId === MAGIC_VALUE_ID && row.source.entryKey === uid && String(row.source.resourceKey || '') === String(rule.resource_key || ''))
    const error = weaponUseError(rule) || (!owner ? 'Применять оружие может владелец персонажа.' : '')
      || (owned.entry.params?.magic?.weapon_use?.status === 'active' ? 'Завершите текущее применение этого предмета.' : '')
      || (Number(rule.resource_cost) > 0 && (!resource || resource.value < Number(rule.resource_cost)) ? 'Недостаточно ресурса для применения.' : '')
    return { ...rule, resource, error, disabled: !!error }
  })
}

function stepSnapshot(step, base, damageTypes, range) {
  const type = damageTypes.find(row => Number(row.id) === Number(step.damage_type))
  const action = { ...step, damage_type_label: type?.value || `Тип урона #${step.damage_type}`, damage_type_color: type?.color }
  const weapon = step.kind === 'weapon_damage'
  return { ...JSON.parse(JSON.stringify(step)), status: 'pending',
    expression: weaponDamageActionExpression({ baseExpression: weapon ? base.expression : '', action }),
    critical_expression: weaponDamageActionExpression({ baseExpression: weapon ? base.critical_expression : '', action, critical: weapon }),
    ...(step.area ? { area: { ...step.area, length_ft: range } } : {}),
  }
}

/** One patch both pays for the attack and opens its independent follow-up steps. */
export function startWeaponUse(values, items, uid, key, base, damageTypes = [], owner = true) {
  const rule = availableWeaponUses(values, items, uid, owner).find(row => row.key === key)
  if (!rule || rule.error) return { error: rule?.error || 'Особое применение недоступно.', patch: {} }
  if (rule.steps.some(step => step.kind === 'weapon_damage') && (!base.expression || !base.critical_expression)) return { error: 'Не удалось рассчитать урон основы.', patch: {} }
  const patch = Number(rule.resource_cost) > 0 ? setCharacterResourceAvailable(values, items, rule.resource.key, rule.resource.value - Number(rule.resource_cost), undefined, true) : {}
  const event = { id: crypto.randomUUID(), key: rule.key, title: rule.title, status: 'active', created_at: new Date().toISOString(),
    range_ft: rule.range_ft, attack_mode: rule.attack_mode, resource_cost: Number(rule.resource_cost), resource_title: rule.resource?.title,
    steps: rule.steps.map(step => stepSnapshot(step, base, damageTypes, rule.range_ft)) }
  return { error: '', event, patch: { ...patch, ...mapOwnedEntries({ ...values, ...patch }, row => row.uid === uid
    ? { ...row, params: { ...row.params, magic: { ...row.params?.magic, weapon_use: event } } } : row) } }
}

export function weaponUseState(values, uid) { return inventoryEntries(values).find(row => row.entry.uid === uid)?.entry.params?.magic?.weapon_use }
export function updateWeaponUse(values, uid, eventId, update) {
  const event = weaponUseState(values, uid)
  if (!event || event.id !== eventId || event.status !== 'active') return {}
  const next = update(event)
  if (!next) return {}
  return mapOwnedEntries(values, row => row.uid === uid ? { ...row, params: { ...row.params, magic: { ...row.params?.magic, weapon_use: next } } } : row)
}
export function completeWeaponUseStep(values, uid, eventId, key, result, critical = false) {
  return updateWeaponUse(values, uid, eventId, event => {
    const step = event.steps.find(row => row.key === key)
    if (!step || step.status !== 'pending' || (result == null && step.kind !== 'weapon_damage') || (result != null && !Number.isFinite(result.total))) return null
    return { ...event, steps: event.steps.map(row => row.key === key ? { ...row, status: result == null ? 'missed' : 'rolled',
      result, critical: row.kind === 'weapon_damage' && critical, ...(row.save?.half && result ? { half_result: Math.floor(result.total / 2) } : {}) } : row) }
  })
}
export function finishWeaponUse(values, uid, eventId) {
  return updateWeaponUse(values, uid, eventId, event => ({ ...event, status: 'completed', completed_at: new Date().toISOString() }))
}
