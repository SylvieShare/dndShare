export function availableSpellSlotLevels(slots, spellLevel) {
  const level = Math.max(0, Number(spellLevel) || 0)
  if (level === 0) return [0]
  return (Array.isArray(slots) ? slots : [])
    .filter(slot => Number(slot.level) >= level && Number(slot.used) < Number(slot.total))
    .map(slot => Number(slot.level))
    .sort((a, b) => a - b)
}
