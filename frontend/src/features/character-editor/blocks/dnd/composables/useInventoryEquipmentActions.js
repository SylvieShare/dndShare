import { ref } from 'vue'
import { appendOwnedEntry, ownedEntryToWeapons, takeInventoryEntry } from '../lib/itemPlacement'
import { setInventoryWeaponEnabled } from '@/features/character-editor/lib/inventoryWeapons'
import { weaponBaseId } from '@/features/character-editor/lib/magicWeapons'

export function useInventoryEquipmentActions({ model, catalog, specializedDestinations, canManage, charCtx, entryTypeId }) {
  const pendingWeapon = ref(null)
  const item = entry => catalog[entry.item_id] || entry.display?.base
  const isMagicWeapon = entry => Number(item(entry)?.typeId) === 19 && !!item(entry)?.data?.weapon
  const isInWeapons = entry => isMagicWeapon(entry) && entry.params?.weapon_enabled === true
    && model.value.equipped.some(row => row.uid === entry.uid)

  function specializedDestination(entry) {
    if (isMagicWeapon(entry)) return { value_id: 'weapon', label: 'Оружие' }
    return specializedDestinations.value.find(destination => Number(destination.type_id) === entryTypeId(entry)) || null
  }
  function canMoveToSpecialized(entry) {
    return canManage.value && typeof charCtx.updateValues === 'function' && !!specializedDestination(entry) && !isInWeapons(entry)
  }
  function enableWeapon(entry, params = {}) {
    charCtx.updateValues({ items: setInventoryWeaponEnabled(model.value, entry.uid, true, params) })
  }
  function confirmWeapon(params) {
    if (!pendingWeapon.value || !canManage.value) return
    enableWeapon(pendingWeapon.value, params)
    pendingWeapon.value = null
  }
  function hideWeapon(entry, close) {
    if (!canManage.value) return
    charCtx.updateValues({ items: setInventoryWeaponEnabled(model.value, entry.uid, false) })
    close()
  }
  function moveToSpecialized(sectionId, entry, close) {
    if (!canMoveToSpecialized(entry)) return
    if (isMagicWeapon(entry)) {
      if (weaponBaseId(item(entry), entry)) enableWeapon(entry)
      else pendingWeapon.value = { uid: entry.uid, item: item(entry), params: entry.params }
      close()
      return
    }
    const destination = specializedDestination(entry)
    const taken = takeInventoryEntry(model.value, sectionId, entry.uid)
    if (!destination || !taken) return
    const currentValues = charCtx.values || {}, targetId = destination.value_id
    const target = targetId === 'weapon'
      ? [...(Array.isArray(currentValues.weapon) ? currentValues.weapon : []), ...ownedEntryToWeapons(taken.entry)]
      : appendOwnedEntry(currentValues[targetId], taken.entry)
    charCtx.updateValues({ items: taken.inventory, [targetId]: target })
    close()
  }
  return { pendingWeapon, confirmWeapon, hideWeapon, isInWeapons, specializedDestination, canMoveToSpecialized, moveToSpecialized }
}
