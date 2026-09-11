import { initializeItemCharges, initialChargeStocks } from '@/shared/lib/itemInitialCharges'
import { actionableItemChoices } from '@/features/items/lib/itemChoices'
import { magicBaseId, magicEquipmentKinds, baseParamKey } from '@/features/items/lib/magicEquipmentBases'
import { inventoryEntries, mapOwnedEntries } from './characterMagicItems'
import { createWeaponInstance } from './magicWeapons'

export const needsAttunement = item => Number(item?.typeId) === 19 && item.data?.attunement !== 'none'
export const hasMagicInstanceOptions = item => initialChargeStocks(item?.data).length > 0 || !!item?.data?.manual_size || actionableItemChoices(item).length > 0
export function missingMagicBases(item, entry) {
  return magicEquipmentKinds(item).filter(kind => !(kind === 'weapon' && entry?.magic_item_id) && !Number(entry?.params?.[baseParamKey(kind)] || item.data?.[kind]?.base_item_id))
}
export const hasMagicItemMenuActions = (item, entry) => needsAttunement(item) || hasMagicInstanceOptions(item) || missingMagicBases(item, entry).length > 0
export function setInstanceAttunement(values, item, uid, attuned) {
  if (!needsAttunement(item) || inventoryEntries(values).find(row => row.entry.uid === uid)?.entry.params?.magic?.lost) return {}
  return mapOwnedEntries(values, row => row.uid === uid && Number(row.magic_item_id ?? row.item_id) === Number(item.id)
    ? { ...row, params: { ...row.params, magic: { ...row.params?.magic, attuned: !!attuned } } }
    : row)
}
/** Fill an absent base once; an existing instance's physical identity stays fixed. */
export function fillMissingMagicBases(values, item, uid, selectedParams) {
  const entry = inventoryEntries(values).find(row => row.entry.uid === uid)?.entry
  if (!entry || Number(entry.magic_item_id ?? entry.item_id) !== Number(item.id)) return {}
  const missing = missingMagicBases(item, entry)
  if (!missing.length || missing.some(kind => !magicBaseId(item, selectedParams, kind))) return {}
  const params = initialChargeStocks(item.data).reduce((next, stock) => initializeItemCharges(next, stock.key ? selectedParams.magic?.resource_maxima?.[stock.key] : selectedParams.magic?.max_use, stock.key), { ...entry.params })
  for (const kind of missing) params[baseParamKey(kind)] = magicBaseId(item, selectedParams, kind)
  const next = missing.includes('weapon') ? createWeaponInstance(item, { ...entry, params }) : { ...entry, params }
  return mapOwnedEntries(values, row => row.uid === uid ? next : row)
}
