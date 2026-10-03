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

export function bagColumnCount(width) {
  return Math.max(1, Math.floor((Math.max(0, Number(width) || 0) + 8) / 80))
}

export function bagCells(entries, positions = {}, getKey = entry => entry.uid, columns = BAG_COLUMNS) {
  const resolved = resolveBagSlots(entries, positions, getKey)
  const last = Math.max(-1, ...Object.values(resolved))
  const size = Math.max(columns, Math.ceil((last + 1) / columns) * columns)
  const cells = Array(size).fill(null)
  for (const entry of entries) cells[resolved[getKey(entry)]] = entry
  if (cells.slice(-columns).some(Boolean)) cells.push(...Array(columns).fill(null))
  return cells
}
