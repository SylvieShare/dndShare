export function availableSpellSlotLevels(slots, spellLevel) {
  const level = Math.max(0, Number(spellLevel) || 0)
  if (level === 0) return [0]
  return (Array.isArray(slots) ? slots : [])
    .filter(slot => Number(slot.level) >= level && Number(slot.used) < Number(slot.total))
    .map(slot => Number(slot.level))
    .sort((a, b) => a - b)
}

export function availableSpellSlotOptions(slotPools, spellLevel) {
  const level = Math.max(0, Number(spellLevel) || 0)
  if (level === 0) return [{ pool: 'cantrip', level: 0, remaining: null }]
  const options = []
  for (const pool of ['long_rest', 'short_rest']) {
    for (const slot of (Array.isArray(slotPools?.[pool]) ? slotPools[pool] : [])) {
      if (Number(slot.level) < level || Number(slot.used) >= Number(slot.total)) continue
      options.push({
        pool,
        level: Number(slot.level),
        remaining: Math.max(0, Number(slot.total) - Number(slot.used)),
      })
    }
  }
  return options.sort((left, right) => left.level - right.level || (left.pool === 'long_rest' ? -1 : 1))
}
