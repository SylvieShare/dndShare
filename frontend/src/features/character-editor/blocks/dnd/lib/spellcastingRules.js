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
  const ability = number(spellcasting.ability)
  const prepares = !!spellcasting.prepares
  if (cantripsKnown == null && spellsKnown == null && listClassId == null && ability == null && !prepares) return null
  return {
    ability,
    prepares,
    cantripsKnown: Math.max(0, cantripsKnown || 0),
    spellsKnown: Math.max(0, spellsKnown || 0),
    hasKnownProgression: Array.isArray(spellcasting.known_progression) && spellcasting.known_progression.length > 0,
    listClassId,
    allowedSchoolIds: (Array.isArray(spellcasting.allowed_schools) ? spellcasting.allowed_schools : [])
      .map(referenceId).filter((id) => id != null),
    unrestrictedSpells: Math.max(0, number(unrestricted?.count) || 0),
  }
}

function sourceKey(entry) {
  return `class:${entry?.id ?? ''}:${entry?.subclass?.id ?? ''}`
}

/** Every class owns its spell list, preparation rules and casting ability. */
export function characterSpellcastingSources(entries, itemsById) {
  const sources = []
  for (const entry of (Array.isArray(entries) ? entries : [])) {
    const classItem = itemsById?.[entry?.id]
    const subclass = entry?.subclass?.id != null ? itemsById?.[entry.subclass.id] : null
    const rules = spellcastingRulesAt(subclass, Number(entry.level) || 1)
      || spellcastingRulesAt(classItem, Number(entry.level) || 1)
    if (!rules) continue
    sources.push({
      ...rules,
      key: sourceKey(entry),
      classId: referenceId(entry?.id),
      subclassId: referenceId(entry?.subclass?.id),
      classLevel: Math.max(1, number(entry?.level) || 1),
      label: String(classItem?.name || classItem?.nameEn || 'Класс'),
      listClassId: rules.listClassId ?? referenceId(entry?.id),
      entry,
    })
  }
  return sources
}

/** Resolve the rules contributed by the selected class or subclass. */
export function characterSpellcastingRules(entries, itemsById) {
  return characterSpellcastingSources(entries, itemsById)[0] || null
}

export function spellCountsTowardKnown(ref) {
  return !ref?.external_only || !!ref?.counts_as_known
}
