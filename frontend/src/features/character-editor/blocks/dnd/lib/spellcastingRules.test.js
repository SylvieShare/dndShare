import { describe, expect, it } from 'vitest'

import { spellcastingRulesAt } from './spellcastingRules'

const trickster = { id: 20, data: { spellcasting: {
  ability: 4,
  list_class: { id: 4014 },
  known_progression: [
    { level: 3, cantrips: 3, spells: 3 },
    { level: 7, cantrips: 3, spells: 5 },
    { level: 10, cantrips: 4, spells: 7 },
  ],
  allowed_schools: [1, 2],
  unrestricted_progression: [{ level: 3, count: 1 }, { level: 8, count: 2 }],
} } }

describe('spellcasting handbook rules', () => {
  it('uses the latest known-spell row at the class level', () => {
    expect(spellcastingRulesAt(trickster, 9)).toMatchObject({
      ability: 4, listClassId: 4014, cantripsKnown: 3, spellsKnown: 5,
      allowedSchoolIds: [1, 2], unrestrictedSpells: 2,
    })
  })

  it('does not expose a half-caster source before its configured start level', () => {
    const paladin = { id: 3, data: { spellcasting: {
      ability: 6, prepares: true, start_level: 2, selection_mode: 'prepared',
    } } }

    expect(spellcastingRulesAt(paladin, 1)).toBeNull()
    expect(spellcastingRulesAt(paladin, 2)).toMatchObject({
      ability: 6, prepares: true, startLevel: 2, selectionMode: 'prepared',
    })
  })
})
