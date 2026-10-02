export const BAG_COLUMNS = 4

// Explicit positions reserve cells first; new entries fill the first hole.
export function resolveBagSlots(entries, positions = {}, getKey = entry => entry.uid) {
  const result = {}, used = new Set()
  for (const entry of entries) {
    const key = getKey(entry), slot = positions[key]
    if (Number.isSafeInteger(slot) && slot >= 0 && !used.has(slot)) {
      result[key] = slot
      used.add(slot)
    }
  }
  let free = 0
  for (const entry of entries) {
    const key = getKey(entry)
    if (result[key] != null) continue
    while (used.has(free)) free++
    result[key] = free
    used.add(free)
  }
  return result
}

export function bagCells(entries, positions = {}, getKey = entry => entry.uid) {
  const resolved = resolveBagSlots(entries, positions, getKey)
  const last = Math.max(-1, ...Object.values(resolved))
  const size = Math.max(BAG_COLUMNS, Math.ceil((last + 1) / BAG_COLUMNS) * BAG_COLUMNS)
  const cells = Array(size).fill(null)
  for (const entry of entries) cells[resolved[getKey(entry)]] = entry
  if (cells.slice(-BAG_COLUMNS).every(Boolean)) cells.push(...Array(BAG_COLUMNS).fill(null))
  return cells
}

export function moveBagEntry(model, { uid, fromId, toId, toSlot }) {
  const from = model.sections.find(section => section.id === fromId)
  const to = model.sections.find(section => section.id === toId)
  const source = fromId === 'equipped' ? model.equipped : from?.items
  if (!source || !to || !Number.isSafeInteger(toSlot) || toSlot < 0) return false
  const index = source.findIndex(entry => entry.uid === uid)
  if (index < 0) return false
  if (from) from.slots = resolveBagSlots(from.items, from.slots)
  to.slots = resolveBagSlots(to.items, to.slots)
  const oldSlot = from?.slots[uid]
  const occupied = to.items.find(entry => to.slots[entry.uid] === toSlot)
  if (occupied?.uid === uid) return false
  const moved = source[index]
  if (fromId !== toId) {
    if (occupied) {
      source.splice(index, 1, occupied)
      to.items.splice(to.items.indexOf(occupied), 1, moved)
    } else {
      source.splice(index, 1)
      to.items.push(moved)
    }
    if (from) {
      delete from.slots[uid]
      if (occupied) from.slots[occupied.uid] = oldSlot
    }
    if (occupied) delete to.slots[occupied.uid]
  } else if (occupied) {
    to.slots[occupied.uid] = oldSlot
    // Keep the list projection in the same order as the grid after a swap.
    const otherIndex = source.indexOf(occupied)
    source[index] = occupied
    source[otherIndex] = moved
  }
  to.slots[uid] = toSlot
  return true
}
