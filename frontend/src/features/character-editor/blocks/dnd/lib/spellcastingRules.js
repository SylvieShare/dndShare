function number(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function referenceId(value) { return number(value?.id ?? value) }

function progressionAt(rows, level) {
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => number(row?.level) != null && number(row.level) <= level)
    .sort((left, right) => number(right.level) - number(left.level))[0] || null
}

export function spellcastingRulesAt(item, level) {
  const spellcasting = item?.data?.spellcasting
  if (!spellcasting || typeof spellcasting !== 'object') return null
  const row = progressionAt(spellcasting.known_progression, Math.max(1, number(level) || 1))
  const unrestricted = progressionAt(spellcasting.unrestricted_progression, Math.max(1, number(level) || 1))
  const cantripsKnown = number(row?.cantrips ?? spellcasting.cantrips_known)
  const spellsKnown = number(row?.spells ?? spellcasting.spells_known)
  const listClassId = referenceId(spellcasting.list_class)
  if (cantripsKnown == null && spellsKnown == null && listClassId == null) return null
  return {
    ability: number(spellcasting.ability),
    cantripsKnown: Math.max(0, cantripsKnown || 0),
    spellsKnown: Math.max(0, spellsKnown || 0),
    listClassId,
    allowedSchoolIds: (Array.isArray(spellcasting.allowed_schools) ? spellcasting.allowed_schools : [])
      .map(referenceId).filter((id) => id != null),
    unrestrictedSpells: Math.max(0, number(unrestricted?.count) || 0),
  }
}

/** Resolve the rules contributed by the selected class or subclass. */
export function characterSpellcastingRules(entries, itemsById) {
  for (const entry of (Array.isArray(entries) ? entries : [])) {
    const subclass = entry?.subclass?.id != null ? itemsById?.[entry.subclass.id] : null
    const fromSubclass = spellcastingRulesAt(subclass, Number(entry.level) || 1)
    if (fromSubclass) return fromSubclass
    const fromClass = spellcastingRulesAt(itemsById?.[entry.id], Number(entry.level) || 1)
    if (fromClass) return fromClass
  }
  return null
}

export function spellCountsTowardKnown(ref) {
  return !ref?.external_only || !!ref?.counts_as_known
}
