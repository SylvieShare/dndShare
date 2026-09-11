import { ref } from 'vue'
import { appendOwnedEntry, ownedEntryToWeapons, takeInventoryEntry } from '../lib/itemPlacement'
import { createWeaponInstance, weaponBaseId } from '@/features/character-editor/lib/magicWeapons'

export function useInventoryEquipmentActions({ model, catalog, specializedDestinations, canManage, charCtx, entryTypeId }) {
  const pendingWeapon = ref(null)
  const item = entry => catalog[entry.magic_item_id ?? entry.item_id] || entry.display?.base
  const isMagicWeapon = entry => !!entry.magic_item_id || Number(item(entry)?.typeId) === 19 && !!item(entry)?.data?.weapon
  function specializedDestination(entry) {
    if (isMagicWeapon(entry)) return { value_id: 'weapon', label: 'Оружие' }
    return specializedDestinations.value.find(destination => Number(destination.type_id) === entryTypeId(entry)) || null
  }
  function canMoveToSpecialized(entry) {
    return canManage.value && typeof charCtx.updateValues === 'function' && !!specializedDestination(entry)
  }
  function transfer(sectionId, entry, params = {}) {
    const destination = specializedDestination(entry)
    const taken = takeInventoryEntry(model.value, sectionId, entry.uid)
    if (!destination || !taken) return
    const currentValues = charCtx.values || {}, targetId = destination.value_id
    const owned = taken.entry.magic_item_id ? taken.entry : createWeaponInstance(item(entry), { ...taken.entry, params: { ...taken.entry.params, ...params } })
    const target = targetId === 'weapon'
      ? [...(Array.isArray(currentValues.weapon) ? currentValues.weapon : []), ...ownedEntryToWeapons(owned)]
      : appendOwnedEntry(currentValues[targetId], owned)
    charCtx.updateValues({ items: taken.inventory, [targetId]: target })
  }
  function confirmWeapon(params) {
    if (!pendingWeapon.value || !canManage.value) return
    transfer(pendingWeapon.value.sectionId, pendingWeapon.value, params)
    pendingWeapon.value = null
  }
  function moveToSpecialized(sectionId, entry, close) {
    if (!canMoveToSpecialized(entry)) return
    if (isMagicWeapon(entry) && !weaponBaseId(item(entry), entry)) pendingWeapon.value = { ...entry, sectionId, item: item(entry) }
    else transfer(sectionId, entry)
    close()
  }
  return { pendingWeapon, confirmWeapon, specializedDestination, canMoveToSpecialized, moveToSpecialized }
}
