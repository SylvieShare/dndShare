import { describe, expect, it } from 'vitest'
import { buildCharacterData } from './buildCharacter'

const selection = (id, name, data = {}) => ({ id, name, item: { id, name, data } })

describe('buildCharacterData skill choices', () => {
  it('records expertise as double proficiency without losing the skill entry', () => {
    const result = buildCharacterData({
      race: selection(1, 'Человек'),
      charClass: selection(2, 'Плут'),
      choices: [{ abilityId: 42, from_suggest_id: 15, expertise: true, selected: [2] }],
      suggestValue: () => '',
    })

    expect(result.data.values.DEX.skills['2']).toMatchObject({ up: 2, override_title: '', bonuses: [] })
    expect(result.data.values.feature_choices['42']).toEqual([2])
  })

  it('keeps regular skill feature choices as normal proficiency', () => {
    const result = buildCharacterData({
      race: selection(1, 'Человек'),
      charClass: selection(2, 'Воин'),
      choices: [{ abilityId: 43, from_suggest_id: 15, selected: [1] }],
      suggestValue: () => '',
    })

    expect(result.data.values.STR.skills['1'].up).toBe(1)
  })
})

describe('buildCharacterData starting equipment', () => {
  it('stores PHB rows without catalog ids as editable custom inventory items', () => {
    const result = buildCharacterData({
      race: selection(1, 'Человек'),
      charClass: selection(2, 'Плут'),
      equipment: [{ id: null, name: 'Кинжал', count: 2 }],
      suggestValue: () => '',
    })

    expect(result.data.values.items.sections[0].items[0]).toMatchObject({
      id: null,
      count: 2,
      override: { name: 'Кинжал' },
    })
  })

  it('adds background possessions to inventory and its gold to the wallet', () => {
    const result = buildCharacterData({
      race: selection(1, 'Человек'),
      charClass: selection(2, 'Плут'),
      background: selection(3, 'Дворянин', {
        equipment: '<p>Изящная одежда, перстень-печатка, свиток родословной, кошель с 25 зм.</p>',
        feature: 'Привилегированное положение',
        feature_desc: '<p>Люди склонны думать о вас хорошо.</p>',
      }),
      equipment: [{ id: null, name: 'Рапира', count: 1 }],
      suggestValue: () => '',
    })

    const items = result.data.values.items.sections[0].items
    expect(items.map((item) => item.override?.name)).toEqual([
      'Рапира', 'Изящная одежда', 'перстень-печатка', 'свиток родословной',
    ])
    expect(result.data.values.money.amounts['3']).toBe(25)
    expect(result.data.values.notes).toBe('Умение предыстории — Привилегированное положение: Люди склонны думать о вас хорошо.')
  })
})

describe('buildCharacterData persona', () => {
  it('preserves rich persona fields and stores backstory and allies in their sheet blocks', () => {
    const result = buildCharacterData({
      race: selection(1, 'Человек'),
      charClass: selection(2, 'Воин'),
      persona: {
        traits: '<p><b>Смелый</b> и любознательный</p>',
        backstory: '<p>Вырос в портовом городе</p>',
        allies: '<ul><li>Гильдия картографов</li></ul>',
      },
    })

    expect(result.data.values.person_traits).toBe('<p><b>Смелый</b> и любознательный</p>')
    expect(result.data.values.person_backstory).toBe('<p>Вырос в портовом городе</p>')
    expect(result.data.values.person_allies).toBe('<ul><li>Гильдия картографов</li></ul>')
  })
})

describe('buildCharacterData feats', () => {
  it('stores feat choices and applies simple ASI and proficiency grants', () => {
    const feat = {
      id: 70,
      name: 'Стойкий ученик',
      data: {
        asi_choice: { choice_key: 'ability', bonus: 1 },
        grants: { armor_prof: [2], skill_prof: [2], save_prof: [4] },
        max_use: 2,
      },
    }
    const labels = { '3:2': 'Средние доспехи' }
    const result = buildCharacterData({
      race: selection(1, 'Человек'),
      charClass: selection(2, 'Воин'),
      scores: { STR: 10, DEX: 10, CON: 15, INT: 10, WIS: 10, CHA: 10 },
      feats: [{ item: feat, choices: { ability: [3] } }],
      suggestValue: (typeId, id) => labels[`${typeId}:${id}`] || '',
    })

    expect(result.data.values.CON.value).toEqual({ base: 15, bonuses: [{ title: 'Стойкий ученик', value: 1 }] })
    expect(result.data.values.hp.max).toBe(13)
    expect(result.data.values.proficiencies['Доспехи']).toContain('Средние доспехи')
    expect(result.data.values.DEX.skills['2'].up).toBe(1)
    expect(result.data.values.INT.save_up).toBe(true)
    expect(result.data.values.abilities_feats[0]).toMatchObject({ id: 70, count: 2, choices: { ability: [3] } })
  })
})
