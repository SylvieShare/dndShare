import { describe, expect, it } from 'vitest'
import { raceCardSummary, shortRaceDescription } from './raceCardSummary'

describe('race card summary', () => {
  it('turns handbook html into a compact plain-text description', () => {
    expect(shortRaceDescription({ data: { description: '<p>Древний&nbsp;народ <b>гор</b>.</p>' } }))
      .toBe('Древний народ гор.')
  })

  it('collects base grants and lists subraces without applying their grants', () => {
    const race = {
      id: 4,
      data: {
        asi: [{ ability: 2, bonus: 2 }],
        speed: 30,
        size: 'Средний',
        languages: [10],
        lang_choice: { count: 1, from: [11] },
      },
    }
    const summary = raceCardSummary({
      race,
      subraces: ['Высший эльф', 'Лесной эльф'],
      suggestValue: (typeId, id) => typeId === 6 && id === 10 ? 'Общий' : '',
    })

    expect(summary.facts).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Характеристики', value: 'ЛОВ +2' }),
      expect.objectContaining({ label: 'Языки', value: 'Общий' }),
    ]))
    expect(summary.subraces).toEqual(['Высший эльф', 'Лесной эльф'])
    expect(summary.choices).toEqual(['язык'])
  })

  it('keeps race ability descriptions for card tooltips', () => {
    const summary = raceCardSummary({
      race: { id: 4, data: {} },
      raceAbilities: [{
        id: 10,
        name: 'Тёмное зрение',
        data: { level: 1, race_ids: [{ id: 4 }], description: '<p>Видит в темноте.</p>' },
      }],
    })

    expect(summary.facts).toContainEqual(expect.objectContaining({
      label: 'Способности',
      entries: [{ name: 'Тёмное зрение', description: '<p>Видит в темноте.</p>' }],
    }))
  })
})
