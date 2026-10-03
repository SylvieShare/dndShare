import { canEquipInventoryItem } from '@/features/character-editor/blocks/dnd/lib/inventorySpaces'

export function inventoryCellTraits(item, entry, equipped = false) {
  return {
    simplified: entry?.item_id == null,
    wearable: equipped || canEquipInventoryItem(item),
    usable: !!item?.data?.usable && !entry?.params?.creation?.expired,
  }
}
