import { describe, expect, it } from 'vitest'

import { characterSpellcastingRules, characterSpellcastingSources, spellcastingRulesAt } from './spellcastingRules'

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

  it('keeps a separate source and casting ability for every spellcasting class', () => {
    const sources = characterSpellcastingSources(
      [{ id: 1, level: 4 }, { id: 2, level: 3 }],
      {
        1: { id: 1, name: 'Жрец', data: { spellcasting: { ability: 5, prepares: true } } },
        2: { id: 2, name: 'Волшебник', data: { spellcasting: { ability: 4, prepares: true } } },
      },
    )
    expect(sources).toMatchObject([
      { key: 'class:1:', classId: 1, classLevel: 4, ability: 5, prepares: true, listClassId: 1 },
      { key: 'class:2:', classId: 2, classLevel: 3, ability: 4, prepares: true, listClassId: 2 },
    ])
  })
})
