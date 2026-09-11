import { inventoryEntries, magicItemActive, mapOwnedEntries } from './characterMagicItems'

export function weaponBonusTransfer(entry, item, values, equipped = true) {
  const rule = item?.data?.weapon_bonus_transfer
  const bonus = Number(item?.data?.weapon?.magic_bonus)
  if (!rule || !entry?.magic_item_id || !Number.isInteger(bonus) || bonus <= 0 || bonus > 3) return null
  const stored = Number(entry.params?.magic?.bonus_transfer)
  const selected = Number.isInteger(stored) ? Math.max(0, Math.min(bonus, stored)) : 0
  const active = equipped && magicItemActive(item, entry, equipped, values)
  const value = active ? selected : 0
  return { title: rule.title || 'Перенести в защиту', condition: rule.condition || '',
    max: bonus, selected, value, active, weaponBonus: bonus - value }
}

export function transferArmorEffects(values, itemsById) {
  return inventoryEntries(values).flatMap(({ entry, equipped }) => {
    const item = itemsById.get(String(entry.magic_item_id))
    const transfer = weaponBonusTransfer(entry, item, values, equipped)
    return transfer?.value ? [{ kind: 'armor_bonus', value: transfer.value,
      key: `weapon-transfer:${entry.uid}`, source_label: `${item.name}: перенос в защиту`, source_entry: entry }] : []
  })
}

export function setWeaponBonusTransfer(values, itemsById, uid, amount, owner) {
  if (!owner || !Number.isInteger(amount)) return {}
  const owned = inventoryEntries(values).find(row => row.entry.uid === uid)
  if (!owned) return {}
  const item = itemsById.get(String(owned.entry.magic_item_id))
  const transfer = weaponBonusTransfer(owned.entry, item, values, owned.equipped)
  if (!transfer || amount < 0 || amount > transfer.max || (amount > 0 && !transfer.active)) return {}
  return mapOwnedEntries(values, entry => entry.uid === uid
    ? { ...entry, params: { ...entry.params, magic: { ...entry.params?.magic, bonus_transfer: amount } } }
    : entry)
}
