import { hasInitialChargeStock } from '@/shared/lib/itemInitialCharges'
import { inventoryEntries, magicItemActive, MAGIC_VALUE_ID } from './characterMagicItems'
import { collectCharacterResources, setCharacterResourceAvailable } from './characterResources'

export function confirmedItemUseError(rule) {
  if (!rule?.key || !rule.title?.trim()) return 'Укажите название и ключ свойства.'
  if (!rule.confirm_label?.trim()) return 'Укажите результат, после которого расходуется заряд.'
  const cost = Number(rule.resource_cost)
  if (!Number.isInteger(cost) || cost < 1 || cost > 100) return 'Расход должен быть целым числом от 1 до 100.'
  return ''
}
export function confirmedItemUses(values, items, uid) {
  const owned = inventoryEntries(values).find(row => row.entry.uid === uid)
  const item = items.get(String(owned?.entry.magic_item_id ?? owned?.entry.item_id))
  if (!owned || !magicItemActive(item, owned.entry, owned.equipped, values)) return []
  const resources = collectCharacterResources(values, items)
  return (item.data.confirmed_uses || []).map(rule => {
    const resource = resources.find(row => row.source?.valueId === MAGIC_VALUE_ID && row.source.entryKey === uid
      && String(row.source.resourceKey || '') === String(rule.resource_key || ''))
    return { ...rule, item, resource, error: confirmedItemUseError(rule)
      || (!resource ? (hasInitialChargeStock(owned.entry.params) ? 'Недостаточно зарядов.' : 'Задайте запас зарядов в параметрах экземпляра.') : resource.value < Number(rule.resource_cost) ? 'Недостаточно зарядов.' : '') }
  })
}
/** Only the explicit result confirmation spends; attacks and saves do not call this. */
export function confirmItemUse(values, items, uid, key, owner = false) {
  if (!owner) return {}
  const use = confirmedItemUses(values, items, uid).find(row => row.key === key)
  if (!use || use.error) return {}
  return setCharacterResourceAvailable(values, items, use.resource.key, use.resource.value - Number(use.resource_cost), undefined, true)
}
