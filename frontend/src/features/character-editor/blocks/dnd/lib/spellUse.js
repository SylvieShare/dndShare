export function availableSpellSlotLevels(slots, spellLevel) {
  const level = Math.max(0, Number(spellLevel) || 0)
  if (level === 0) return [0]
  return (Array.isArray(slots) ? slots : [])
    .filter(slot => Number(slot.level) >= level && Number(slot.used) < Number(slot.total))
    .map(slot => Number(slot.level))
    .sort((a, b) => a - b)
}

export function availableSpellSlotOptions(slots, pactSlot, spellLevel) {
  const level = Math.max(0, Number(spellLevel) || 0)
  if (level === 0) return [{ pool: 'cantrip', level: 0, remaining: null }]
  const options = (Array.isArray(slots) ? slots : [])
    .filter((slot) => Number(slot.level) >= level && Number(slot.used) < Number(slot.total))
    .map((slot) => ({
      pool: 'spellcasting',
      level: Number(slot.level),
      remaining: Math.max(0, Number(slot.total) - Number(slot.used)),
    }))
  if (pactSlot && Number(pactSlot.level) >= level && Number(pactSlot.used) < Number(pactSlot.total)) {
    options.push({
      pool: 'pact',
      level: Number(pactSlot.level),
      remaining: Math.max(0, Number(pactSlot.total) - Number(pactSlot.used)),
    })
  }
  return options.sort((left, right) => left.level - right.level || (left.pool === 'spellcasting' ? -1 : 1))
}
