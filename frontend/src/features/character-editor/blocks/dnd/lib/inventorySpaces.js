import { resolveBagSlots } from '@/features/inventory/lib/bagSlots'

export function isInventoryEquipped(model, uid) {
  return model.equipped.some(entry => entry.uid === uid)
}

export function inventorySpaceEntries(model, id) {
  const section = model.sections.find(space => space.id === id)
  if (!section) return []
  return [...section.items, ...model.equipped.filter(entry => Object.hasOwn(section.slots || {}, entry.uid))]
}

// Slots also locate equipped entries in their physical space; equipped remains the mechanics source.
export function normalizeInventorySpaces(model) {
  const equippedBySpace = new Map(model.sections.map(section => [section.id, []]))
  for (const entry of model.equipped) {
    const section = model.sections.find(space => Number.isSafeInteger(space.slots?.[entry.uid]) && space.slots[entry.uid] >= 0) || model.sections[0]
    if (section) equippedBySpace.get(section.id).push(entry)
  }
  for (const section of model.sections) {
    section.slots = resolveBagSlots([...section.items, ...equippedBySpace.get(section.id)], section.slots)
  }
  return model
}

export function canEquipInventoryItem(item) {
  const data = item?.data || {}
  return [1, 12].includes(Number(item?.typeId)) || !!data.armor || !!data.armor_base || !!data.weapon
    || Number(item?.typeId) === 19 && data.activation !== 'carried'
    || Object.values(data).some(value => Array.isArray(value) && value.some(rule => rule?.activation === 'equipped'))
}

export function toggleInventoryEquipment(model, uid) {
  const space = model.sections.find(section => inventorySpaceEntries(model, section.id).some(entry => entry.uid === uid))
  if (!space) return false
  const equippedIndex = model.equipped.findIndex(entry => entry.uid === uid)
  if (equippedIndex >= 0) space.items.push(...model.equipped.splice(equippedIndex, 1))
  else {
    const index = space.items.findIndex(entry => entry.uid === uid)
    if (index < 0) return false
    model.equipped.push(...space.items.splice(index, 1))
  }
  return true
}

export function moveInventoryCell(model, { uid, fromId, toId, toSlot }) {
  const from = model.sections.find(space => space.id === fromId)
  const to = model.sections.find(space => space.id === toId)
  if (!from || !to || !Number.isSafeInteger(toSlot) || toSlot < 0) return false
  const moved = inventorySpaceEntries(model, fromId).find(entry => entry.uid === uid)
  if (!moved) return false
  const occupied = inventorySpaceEntries(model, toId).find(entry => to.slots[entry.uid] === toSlot)
  if (occupied?.uid === uid) return false
  const oldSlot = from.slots[uid]
  if (fromId !== toId) {
    if (!isInventoryEquipped(model, uid)) {
      from.items.splice(from.items.indexOf(moved), 1)
      to.items.push(moved)
    }
    if (occupied && !isInventoryEquipped(model, occupied.uid)) {
      to.items.splice(to.items.indexOf(occupied), 1)
      from.items.push(occupied)
    }
    delete from.slots[uid]
    if (occupied) delete to.slots[occupied.uid]
  }
  if (occupied) from.slots[occupied.uid] = oldSlot
  to.slots[uid] = toSlot
  return true
}
