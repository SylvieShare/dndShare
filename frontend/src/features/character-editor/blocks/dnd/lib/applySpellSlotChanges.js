function removeUpgradedSlots(slots, change) {
  const previous = slots.find((slot) => Number(slot.level) === change.fromLevel)
  if (!previous) return 0
  const removed = Math.min(Number(previous.total) || 0, change.count)
  // Pools have aggregate usage: transfer spent slots first so leveling does not
  // restore them. Any slots above the old class count remain on the old circle.
  const spent = Math.min(Number(previous.used) || 0, removed)
  previous.total -= removed
  previous.used -= spent
  if (previous.total === 0) slots.splice(slots.indexOf(previous), 1)
  return spent
}

export function applySpellSlotChanges(pools, changes) {
  const result = Object.fromEntries(['long_rest', 'short_rest'].map((rest) => [rest,
    (pools?.[rest] || []).map((slot) => ({ ...slot })),
  ]))
  for (const change of changes) {
    if (!['added', 'upgraded'].includes(change.kind) || change.count <= 0) continue
    const slots = result[change.pact ? 'short_rest' : 'long_rest']
    const spent = change.kind === 'upgraded' ? removeUpgradedSlots(slots, change) : 0
    const existing = slots.find((slot) => Number(slot.level) === change.level)
    if (existing) {
      existing.total = (Number(existing.total) || 0) + change.count
      existing.used = (Number(existing.used) || 0) + spent
    } else slots.push({ level: change.level, total: change.count, used: spent })
  }
  for (const slots of Object.values(result)) slots.sort((a, b) => a.level - b.level)
  return result
}
