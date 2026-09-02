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
  const classLevel = Math.max(1, number(level) || 1)
  const startLevel = Math.max(1, number(spellcasting.start_level) || 1)
  if (classLevel < startLevel) return null
  const row = progressionAt(spellcasting.known_progression, classLevel)
  const unrestricted = progressionAt(spellcasting.unrestricted_progression, classLevel)
  const cantripsKnown = number(row?.cantrips ?? spellcasting.cantrips_known)
  const spellsKnown = number(row?.spells ?? spellcasting.spells_known)
  const listClassId = referenceId(spellcasting.list_class)
  const ability = number(spellcasting.ability)
  const prepares = !!spellcasting.prepares
  if (cantripsKnown == null && spellsKnown == null && listClassId == null && ability == null && !prepares) return null
  return {
    ability,
    prepares,
    startLevel,
    selectionMode: String(spellcasting.selection_mode || (prepares ? 'prepared' : 'known')),
    levelUpChoices: Math.max(0, number(spellcasting.level_up_choices) || 0),
    cantripsKnown: cantripsKnown == null ? null : Math.max(0, cantripsKnown),
    spellsKnown: spellsKnown == null ? null : Math.max(0, spellsKnown),
    hasKnownProgression: Array.isArray(spellcasting.known_progression) && spellcasting.known_progression.length > 0,
    listClassId,
    allowedSchoolIds: (Array.isArray(spellcasting.allowed_schools) ? spellcasting.allowed_schools : [])
      .map(referenceId).filter((id) => id != null),
    unrestrictedSpells: Math.max(0, number(unrestricted?.count) || 0),
  }
}
