import { describe, expect, it } from 'vitest'

import { characterSpellcastingRules, spellcastingRulesAt } from './spellcastingRules'

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

  it('prefers a selected subclass over the base class', () => {
    expect(characterSpellcastingRules(
      [{ id: 1, level: 10, subclass: { id: 20 } }],
      { 1: { id: 1, data: {} }, 20: trickster },
    )).toMatchObject({ cantripsKnown: 4, spellsKnown: 7 })
  })
})
