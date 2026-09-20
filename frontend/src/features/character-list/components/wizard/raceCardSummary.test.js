import { describe, expect, it } from 'vitest'
import { raceCardSummary, shortRaceDescription } from './raceCardSummary'

describe('race card summary', () => {
  it('turns handbook html into a compact plain-text description', () => {
    expect(shortRaceDescription({ data: { description: '<p>Древний&nbsp;народ <b>гор</b>.</p>' } }))
      .toBe('Древний народ гор.')
  })

  it('prefers a mechanics-free short description over the expanded article', () => {
    expect(shortRaceDescription({ data: {
      short_description: 'Живёт между двумя культурами и ищет собственный путь.',
      description: '<p>Получает +2 к Харизме и другие преимущества.</p>',
    } })).toBe('Живёт между двумя культурами и ищет собственный путь.')
  })

  it('collects base grants and lists subraces without applying their grants', () => {
    const race = {
      id: 4,
      data: {
        asi: [{ ability: 2, bonus: 2 }],
        speed: 30,
        size: 'Средний',
        languages: [10],
        skill_prof: [10],
        lang_choice: { count: 1, from: [11] },
      },
    }
    const summary = raceCardSummary({
      race,
      subraces: ['Высший эльф', 'Лесной эльф'],
      suggestValue: (typeId, id) => typeId === 6 && id === 10 ? 'Общий' : typeId === 15 && id === 10 ? 'Внимание' : '',
    })

    expect(summary.facts).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Характеристики', value: 'ЛОВ +2' }),
      expect.objectContaining({ label: 'Языки', value: 'Общий' }),
      expect.objectContaining({ label: 'Владения', value: 'Внимание' }),
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
        data: { level: 1, race_ids: [{ id: 4 }], desc: '<p>Видит в темноте.</p>' },
      }],
    })

    expect(summary.facts).toContainEqual(expect.objectContaining({
      label: 'Способности',
      entries: [{ name: 'Тёмное зрение', description: '<p>Видит в темноте.</p>' }],
    }))
  })
  it('moves abilities out of the selected preview and shows the actual variant size and speed', () => {
    const race = { id: 4, data: { creature_type: 'Гуманоид', size: 'Средний', speed: 30,
      variants: [{ value: 'small', size: 'Маленький' }, { value: 'wood', size: 'Средний', speed: 35 }] } }
    const raceAbilities = [{ id: 10, name: 'Зрение', data: { race_ids: [{ id: 4 }], level: 1 } }]
    const selected = raceCardSummary({ race, raceAbilities, selected: true, raceVariant: 'wood' })
    expect(selected.facts.some(f => f.label === 'Способности')).toBe(false)
    expect(selected.facts).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Тип существа', value: 'Гуманоид' }),
      expect.objectContaining({ label: 'Скорость', value: '35 фт' }),
      expect.objectContaining({ label: 'Размер', value: 'Средний' }),
    ]))
    expect(raceCardSummary({ race }).facts).toContainEqual(expect.objectContaining({ label: 'Размер', value: 'Маленький / Средний' }))
  })

  it('uses selected subrace speed in the race header', () => {
    const summary = raceCardSummary({ race: { id: 1, data: { speed: 30 } }, subrace: { id: 2, data: { speed: 35 } }, selected: true })
    expect(summary.facts).toContainEqual(expect.objectContaining({ label: 'Скорость', value: '35 фт' }))
  })

})
