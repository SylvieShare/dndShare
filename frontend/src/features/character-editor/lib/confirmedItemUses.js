import { itemRuleActive } from './itemRuleActivation'
import { hasInitialChargeStock } from '@/shared/lib/itemInitialCharges'
import { inventoryEntries, mapOwnedEntries, MAGIC_VALUE_ID } from './characterMagicItems'
import { collectCharacterResources, setCharacterResourceAvailable } from './characterResources'

export function confirmedItemUseError(rule) {
  if (!rule?.key || !rule.title?.trim()) return 'Укажите название и ключ свойства.'
  if (!rule.confirm_label?.trim()) return 'Укажите результат, после которого расходуется заряд.'
  const cost = Number(rule.resource_cost)
  if (!Number.isInteger(cost) || cost < 1 || cost > 100) return 'Расход должен быть целым числом от 1 до 100.'
  if (rule.cooldown_dawns != null && (!Number.isInteger(Number(rule.cooldown_dawns)) || Number(rule.cooldown_dawns) < 0 || Number(rule.cooldown_dawns) > 100)) return 'Ожидание должно быть целым числом от 0 до 100 рассветов.'
  return ''
}
export function confirmedItemUses(values, items, uid) {
  const owned = inventoryEntries(values).find(row => row.entry.uid === uid)
  const item = items.get(String(owned?.entry.magic_item_id ?? owned?.entry.item_id))
  if (!owned || !item || owned.entry.params?.magic?.lost) return []
  const resources = collectCharacterResources(values, items)
  return (item.data.confirmed_uses || []).filter(rule => itemRuleActive(values, item, owned.entry, rule)).map(rule => {
    const resource = resources.find(row => row.source?.valueId === MAGIC_VALUE_ID && row.source.entryKey === uid
      && String(row.source.resourceKey || '') === String(rule.resource_key || ''))
    const cooldown = Math.max(0, Number(owned.entry.params?.magic?.use_cooldowns?.[rule.key]) || 0)
    return { ...rule, item, resource, cooldown, error: confirmedItemUseError(rule) || (cooldown ? `До следующего применения: ${cooldown} рассвет(ов).` : '')
      || (!resource ? (hasInitialChargeStock(owned.entry.params, rule.resource_key || '') ? 'Недостаточно зарядов.' : 'Задайте запас зарядов в параметрах экземпляра.') : resource.value < Number(rule.resource_cost) ? 'Недостаточно зарядов.' : '') }
  })
}
/** Only the explicit result confirmation spends; attacks and saves do not call this. */
export function confirmItemUse(values, items, uid, key, owner = false) {
  if (!owner) return {}
  const use = confirmedItemUses(values, items, uid).find(row => row.key === key)
  if (!use || use.error) return {}
  const patch = setCharacterResourceAvailable(values, items, use.resource.key, use.resource.value - Number(use.resource_cost), undefined, true)
  if (!Object.keys(patch).length || !Number(use.cooldown_dawns)) return patch
  return { ...patch, ...mapOwnedEntries({ ...values, ...patch }, entry => entry.uid === uid ? {
    ...entry, params: { ...entry.params, magic: { ...entry.params?.magic, use_cooldowns: { ...entry.params?.magic?.use_cooldowns, [key]: Number(use.cooldown_dawns) } } },
  } : entry) }
}
