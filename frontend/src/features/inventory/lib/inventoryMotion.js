export function inventoryMembershipChanges(previous, next) {
  return {
    added: next.rows.filter(row => !previous.keys.has(row.key)).map(row => row.key),
    removed: previous.rows.filter(row => !next.keys.has(row.key)).map(row => row.key),
  }
}

export function inventoryQuantityDelta(previous, next) {
  if (String(previous.key) !== String(next.key)) return 0
  const before = Number(previous.count ?? 1), after = Number(next.count ?? 1)
  return Number.isFinite(before) && Number.isFinite(after) && before > 0 && after > 0 ? after - before : 0
}
