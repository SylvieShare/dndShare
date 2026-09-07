import { describe, expect, it } from 'vitest'
import { classProgression } from './classProgression'

const fighter = { id: 10, data: { hit_die: 'd10', subclass_level: 3, asi_levels: '4,6,8,12,14,16,19', skill_choice: { count: 2 } } }
const feature = (id, level, extra = {}) => ({ id, name: `Умение ${id}`, typeId: 4, data: { class_ids: [{ id: 10 }], level, ...extra } })

describe('class handbook roadmap', () => {
  it('shows all levels with class-specific ASI, hit points and proficiency', () => {
    const road = classProgression(fighter)
    expect(road).toHaveLength(20)
    expect(road[0].hitPoints).toBe('10 + мод. ТЕЛ')
    expect(road[1].hitPoints).toBe('1к10 (или 6) + мод. ТЕЛ')
    expect(road[0].choices).toContainEqual({ text: 'Выбрать навыки', count: 2 })
    expect(road[2].choices[0].text).toBe('Выбрать подкласс')
    expect(road[5].choices[0].text).toContain('Повышение характеристик')
    expect(road[6].choices).toEqual([])
    expect(road.filter(row => [1, 5, 9, 13, 17].includes(row.level)).map(row => row.proficiency)).toEqual([2, 3, 4, 5, 6])
  })

  it('isolates subclasses and emits delayed choices and scaling at the right level', () => {
    const abilities = [
      feature(1, 1, { choices: [{ text: 'Стиль', level: 5, count: 1, options: [{ label: 'Защита' }] }], display_scaling: [{ level: 7, label: '2к6' }] }),
      feature(2, 3, { subclass_ids: [{ id: 20 }], scaling: [{ level: 6, uses: 2 }] }),
      feature(3, 3, { subclass_ids: [{ id: 21 }] }),
      feature(4, 1, { class_ids: [{ id: 99 }] }),
    ]
    const base = classProgression(fighter, null, abilities)
    expect(base[2].features).toEqual([])
    const road = classProgression(fighter, { id: 20, name: 'Чемпион' }, abilities)
    expect(road[0].features.map(item => item.id)).toEqual([1])
    expect(road[2].features.map(item => item.id)).toEqual([2])
    expect(road[0].choices.some(choice => choice.text === 'Стиль')).toBe(false)
    expect(road[4].choices).toEqual([expect.objectContaining({ text: 'Стиль', options: 'Защита' })])
    expect(road[5].improvements[0].text).toBe('2 использ.')
    expect(road[6].improvements[0].text).toBe('2к6')
  })

  it('uses single-class half-caster and pact slot pools, not multiclass rounding', () => {
    const half = classProgression({ id: 1, data: { caster_progression: 'half' } })
    expect(half[0].slots.isCaster).toBe(false)
    expect(half[4].slots.totals.slice(0, 2)).toEqual([4, 2])
    const pact = classProgression({ id: 2, data: { caster_progression: 'pact' } })
    expect(pact[10].slots.pact).toEqual({ count: 3, slotLevel: 5 })
    expect(pact[10].slots.totals.every(count => count === 0)).toBe(true)
  })

  it('starts subclass magic at its unlock and only offers increases in known spells', () => {
    const subclass = { id: 20, data: { caster_progression: 'third', spellcasting: {
      start_level: 3, known_progression: [{ level: 3, spells: 3, cantrips: 2 }, { level: 4, spells: 4, cantrips: 2 }],
    } } }
    const road = classProgression(fighter, subclass)
    expect(road[1].slots.isCaster).toBe(false)
    expect(road[2].choices).toContainEqual({ text: 'Выбрать известные заклинания', count: 3 })
    expect(road[3].choices).toContainEqual({ text: 'Выбрать известные заклинания', count: 1 })
    expect(road[3].choices.some(choice => choice.text === 'Выбрать заговоры')).toBe(false)
  })

  it('shows resource unlocks and changes, and does not lose spells granted by a later feature', () => {
    const item = { ...fighter, data: { ...fighter.data, class_resources: [{ title: 'Ки', level: 2, max_use: 2, rollback_short_rest: true, scaling: [{ level: 5, uses: 5 }] }] } }
    const road = classProgression(item, null, [feature(1, 3, { granted_spells: [{ spell: { id: 70 } }] })])
    expect(road[0].resources).toEqual([])
    expect(road[1].resources).toEqual(['Ки: 2 · короткий отдых'])
    expect(road[2].resources).toEqual([])
    expect(road[4].resources).toEqual(['Ки: 5 · короткий отдых'])
    expect(road[2].spells.map(spell => spell.spellId)).toEqual([70])
  })

  it('inherits base casting when a subclass has only a note and counts initial subclass choices', () => {
    const caster = { id: 10, data: { subclass_level: 3, caster_progression: 'full', spellcasting: { cantrips_known: 3, prepares: true } } }
    const inherited = classProgression(caster, { id: 20, data: { spellcasting: { note: 'Правила домена' } } })
    expect(inherited[2].casting.cantripsKnown).toBe(3)
    expect(inherited[2].casting.prepares).toBe(true)
    const unlocked = classProgression(fighter, { id: 20, data: { spellcasting: { cantrips_known: 2 } } })
    expect(unlocked[2].choices).toContainEqual({ text: 'Выбрать заговоры', count: 2 })
  })
})
