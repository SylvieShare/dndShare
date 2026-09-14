import { slotPoolsFromComputation } from './spellbook'

// Compare class progression before/after leveling, never the character's stock.
export function spellSlotAdditions(before, after) {
  const previous = slotPoolsFromComputation(before)
  const next = slotPoolsFromComputation(after)
  return ['long_rest', 'short_rest'].flatMap((rest) => {
    const totals = new Map(previous[rest].map((slot) => [slot.level, slot.total]))
    return next[rest].flatMap((slot) => {
      const count = slot.total - (totals.get(slot.level) || 0)
      return count > 0 ? [{ kind: 'added', level: slot.level, count, pact: rest === 'short_rest' }] : []
    })
  })
}

export function addSpellSlots(pools, changes) {
  const result = Object.fromEntries(['long_rest', 'short_rest'].map((rest) => [rest,
    (pools?.[rest] || []).map((slot) => ({ ...slot })),
  ]))
  for (const change of changes) {
    if (change.kind !== 'added' || change.count <= 0) continue
    const slots = result[change.pact ? 'short_rest' : 'long_rest']
    const existing = slots.find((slot) => Number(slot.level) === change.level)
    if (existing) existing.total = (Number(existing.total) || 0) + change.count
    else slots.push({ level: change.level, total: change.count, used: 0 })
  }
  for (const slots of Object.values(result)) slots.sort((a, b) => a.level - b.level)
  return result
}
