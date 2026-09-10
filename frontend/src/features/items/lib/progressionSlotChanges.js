/** Pact slots upgrade in place; ordinary slots are added to individual circles. */
export function progressionSlotChanges(current, previous) {
  const changes = current.totals.flatMap((total, index) => {
    const count = total - (previous?.totals[index] || 0)
    return count > 0 ? [{ kind: 'added', level: index + 1, count, pact: false }] : []
  })
  if (!current.pact) return changes
  const before = previous?.pact
  if (before && current.pact.slotLevel > before.slotLevel) {
    changes.push({ kind: 'upgraded', level: current.pact.slotLevel, fromLevel: before.slotLevel, count: before.count, pact: true })
  }
  const added = current.pact.count - (before?.count || 0)
  if (added > 0) changes.push({ kind: 'added', level: current.pact.slotLevel, count: added, pact: true })
  return changes
}
