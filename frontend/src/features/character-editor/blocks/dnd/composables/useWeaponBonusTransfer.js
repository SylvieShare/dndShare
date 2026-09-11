import { computed, unref } from 'vue'
import { inventoryEntries } from '@/features/character-editor/lib/characterMagicItems'
import { weaponBonusTransfer, setWeaponBonusTransfer } from '@/features/character-editor/lib/weaponBonusTransfer'

export function useWeaponBonusTransfer(charCtx, uid) {
  const values = () => unref(charCtx.values) || {}
  const items = () => unref(charCtx.characterResources?.itemsById) || new Map()
  const transfer = computed(() => {
    const owned = inventoryEntries(values()).find(row => row.entry.uid === unref(uid))
    return owned ? weaponBonusTransfer(owned.entry, items().get(String(owned.entry.magic_item_id)), values(), owned.equipped) : null
  })
  function setAmount(amount) {
    const patch = setWeaponBonusTransfer(values(), items(), unref(uid), amount, !!charCtx.ownerMode)
    if (Object.keys(patch).length) charCtx.updateValues(patch)
  }
  return { transfer, setAmount }
}
