import { inventoryEntries, magicItemActive } from './characterMagicItems'

/** A dependency may refine the item's activation without changing its siblings. */
export function itemRuleActive(values, item, entry, rule = {}) {
  if (Number(item?.typeId) !== 19) return true
  const owned = inventoryEntries(values).find(row => row.entry.uid === entry.uid)
  if (!owned) return false
  const effective = rule?.activation ? { ...item, data: { ...item.data, activation: rule.activation } } : item
  return magicItemActive(effective, owned.entry, owned.equipped, values)
}
