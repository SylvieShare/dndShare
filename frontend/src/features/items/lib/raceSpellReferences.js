/** Catalogue references use the same level gates as the actual spell grants. */
export function raceSpellReferences(abilities = []) {
  const spells = new Map()
  for (const ability of abilities) {
    for (const grant of ability.data?.granted_spells || []) {
      const id = Number(grant.spell?.id ?? grant.spell)
      if (!Number.isInteger(id) || id <= 0) continue
      const level = Number(grant.level ?? ability.data?.level) || 1
      if (!spells.has(id) || spells.get(id).level > level) {
        spells.set(id, { id, level, condition: `С ${level}-го уровня персонажа` })
      }
    }
  }
  return [...spells.values()].sort((a, b) => a.level - b.level)
}
