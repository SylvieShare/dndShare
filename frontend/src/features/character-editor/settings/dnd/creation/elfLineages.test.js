import { describe, expect, it } from 'vitest'
import { buildCharacterData } from './buildCharacter'
import fixture from '../../../../../../tests/species/data.json'
const choice = item => ({ id: item.id, name: item.name, item })
describe('2024 elf subrace creation', () => {
  for (const name of ['Дроу', 'Высший эльф', 'Лесной эльф']) {
    it(`grants only ${name} level-one abilities and keeps its casting choice`, () => {
      const race = fixture.races.find(r => r.name === 'Эльф')
      const subrace = fixture.subraces.find(s => s.name === name)
      const own = fixture.abilities.filter(a => a.data.subrace_ids?.some(s => s.id === subrace.id) && a.data.level === 1)
      const magic = own.find(a => a.data.choices?.length)
      const result = buildCharacterData({ race: choice(race), subrace: choice(subrace),
        charClass: choice({ id: 1, name: 'Воин', data: {} }), raceAbilityItems: fixture.abilities,
        choices: [{ abilityId: magic.id, choiceKey: 'casting_ability', selectionKey: `${magic.id}:casting_ability`, selected: [4] }],
        suggestValue: () => '',
      }).data.values
      const ids = result.abilities_race.map(a => a.id)
      expect(ids).toEqual(expect.arrayContaining(own.map(a => a.id)))
      expect(ids).toHaveLength(4 + own.length)
      expect(result.abilities_race.find(a => a.id === magic.id).choices).toEqual({ casting_ability: [4] })
      expect(result.subrace.id).toBe(subrace.id)
    })
  }
})
