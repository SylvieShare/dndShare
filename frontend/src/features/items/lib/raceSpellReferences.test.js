import { expect, it } from 'vitest'
import { raceSpellReferences } from './raceSpellReferences'

it('deduplicates spell links at the earliest character level and ignores invalid references', () => {
  expect(raceSpellReferences([
    { data: { level: 5, granted_spells: [{ spell: 12 }, { spell: { id: 13 }, level: 3 }] } },
    { data: { granted_spells: [{ spell: 12, level: 1 }, { spell: null }] } },
  ])).toEqual([
    { id: 12, level: 1, condition: 'С 1-го уровня персонажа' },
    { id: 13, level: 3, condition: 'С 3-го уровня персонажа' },
  ])
})
