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

describe('buildCharacterData hit dice', () => {
  it('creates the level-1 pool from the class selected in the wizard', () => {
    const result = buildCharacterData({
      race: selection(1, 'Человек'),
      charClass: selection(2, 'Волшебник', { hit_die: 'd6' }),
      scores: { CON: 14 },
      suggestValue: () => '',
    })

    expect(result.data.values.hp).toMatchObject({
      max: 8,
      current: 8,
      hitDice: [{ die: 'd6', total: 1, used: 0 }],
    })
  })
})

describe('buildCharacterData spell preparation', () => {
  it('enables preparation automatically for classes that prepare spells', () => {
    const result = buildCharacterData({
      race: selection(1, 'Человек'),
      charClass: selection(2, 'Жрец', { spellcasting: { ability: 5, prepares: true } }),
      suggestValue: () => '',
    })

    expect(result.data.values.spells.preparation).toBe(true)
  })

  it('keeps preparation disabled for known-spell casters', () => {
    const result = buildCharacterData({
      race: selection(1, 'Человек'),
      charClass: selection(2, 'Чародей', { spellcasting: { ability: 6, prepares: false } }),
      suggestValue: () => '',
    })

    expect(result.data.values.spells.preparation).toBe(false)
  })

  it('keeps cantrips unprepared and marks granted leveled spells as permanent', () => {
    const result = buildCharacterData({
      race: selection(1, 'Человек'),
      charClass: selection(2, 'Жрец', { spellcasting: { ability: 5, prepares: true } }),
      spellIds: [100, 101],
      spellLevels: { 100: 0, 101: 1, 102: 1 },
      grantedSpellIds: [102],
      suggestValue: () => '',
    })

    expect(result.data.values.spells.spells).toEqual([
      { id: 100, prepared: false },
      { id: 101, prepared: true },
      { id: 102, prepared: true, always_prepared: true },
    ])
  })
})

describe('buildCharacterData starting equipment', () => {
  it('stores the concrete background tool proficiency instead of its generic category', () => {
    const result = buildCharacterData({
      race: selection(1, 'Человек'),
      charClass: selection(2, 'Плут'),
      background: selection(3, 'Преступник', { tool_prof: [22] }),
      backgroundToolProficiencies: [{ replaces: 22, name: 'Кости' }],
      suggestValue: (typeId, id) => (typeId === 5 && id === 22 ? 'Игровой набор' : ''),
    })

    expect(result.data.values.proficiencies['Инструменты']).toEqual(['Кости'])
  })

  it('puts handbook weapons into the dedicated weapon block instead of inventory', () => {
    const result = buildCharacterData({
      race: selection(1, 'Человек'),
      charClass: selection(2, 'Плут'),
      equipment: [
        { item_id: 101, name: 'Кинжал', count: 2, typeId: 1, params: { magic_bonus: 0 } },
        { item_id: 202, name: 'Верёвка', count: 1, typeId: 2, params: { length_ft: 50 } },
      ],
      suggestValue: () => '',
    })

    expect(result.data.values.weapon).toEqual([
      { item_id: 101, params: { magic_bonus: 0 }, stat_suggest_id: null, proficient: false, add_attacks: [], desc: '' },
      { item_id: 101, params: { magic_bonus: 0 }, stat_suggest_id: null, proficient: false, add_attacks: [], desc: '' },
    ])
    expect(result.data.values.items.sections[0].items).toEqual([
      { uid: 'eq_0', item_id: 202, count: 1, params: { length_ft: 50 }, override: null },
    ])
  })

  it('does not create an empty inventory when only handbook weapons were added', () => {
    const result = buildCharacterData({
      race: selection(1, 'Человек'),
      charClass: selection(2, 'Воин'),
      equipment: [{ item_id: 101, name: 'Длинный меч', count: 1, typeId: 1, params: { magic_bonus: 0 } }],
      suggestValue: () => '',
    })

    expect(result.data.values.weapon).toHaveLength(1)
    expect(result.data.values.items).toBeUndefined()
  })

  it('stores PHB rows without catalog ids as editable custom inventory items', () => {
    const result = buildCharacterData({
      race: selection(1, 'Человек'),
      charClass: selection(2, 'Плут'),
      equipment: [{ item_id: null, name: 'Кинжал', count: 2, params: {} }],
      suggestValue: () => '',
    })

    expect(result.data.values.items.sections[0].items[0]).toMatchObject({
      item_id: null,
      count: 2,
      override: { name: 'Кинжал' },
    })
  })

  it('equips starting armor and derives readonly AC rules from it', () => {
    const result = buildCharacterData({
      race: selection(1, 'Человек'),
      charClass: selection(2, 'Воин'),
      scores: { DEX: 18 },
      equipment: [
        { item_id: null, name: 'Чешуйчатый доспех', count: 1, params: {} },
        { item_id: null, name: 'Щит', count: 1, params: {} },
      ],
      suggestValue: () => '',
    })

    expect(result.data.values.items.equipped).toHaveLength(2)
    expect(result.data.values.armor).toMatchObject({
      ac: 10,
      use_dex: true,
      dex_cap: 2,
      shield: true,
      shield_bonus: 2,
      shield_readonly: true,
    })
    expect(result.data.values.armor.bonuses).toEqual([
      expect.objectContaining({ name: 'Экипировано: Чешуйчатый доспех', value: 4, readonly: true }),
    ])
  })

  it('adds background possessions to inventory and its gold to the wallet', () => {
    const result = buildCharacterData({
      race: selection(1, 'Человек'),
      charClass: selection(2, 'Плут'),
      background: selection(3, 'Дворянин', {
        feature: 'Привилегированное положение',
        feature_desc: '<p>Люди склонны думать о вас хорошо.</p>',
      }),
      equipment: [{ item_id: null, name: 'Рапира', count: 1, params: {} }],
      backgroundEquipment: {
        items: [
          { item_id: 374, name: 'Богатая одежда', count: 1, typeId: 2, params: {} },
          { item_id: 430, name: 'Печатка', count: 1, typeId: 2, params: {} },
          { item_id: 901, name: 'Свиток родословной', count: 1, typeId: 2, params: {} },
        ],
        coins: { 3: 25 },
      },
      suggestValue: () => '',
    })

    const items = result.data.values.items.sections[0].items
    expect(items.map((item) => item.item_id ?? item.override?.name)).toEqual(['Рапира', 374, 430, 901])
    expect(result.data.values.money.amounts['3']).toBe(25)
    expect(result.data.values.notes).toBe('Умение предыстории — Привилегированное положение: Люди склонны думать о вас хорошо.')
  })

  it('replaces class and background gear with shop purchases and keeps the change', () => {
    const result = buildCharacterData({
      race: selection(1, 'Человек'),
      charClass: selection(2, 'Воин'),
      background: selection(3, 'Солдат', {
        equipment_items: [{ item_id: 99, count: 1 }],
      }),
      equipment: [{ item_id: 501, name: 'Латы', count: 1, typeId: 12, params: {}, armor: { ac: 18, use_dex: false } }],
      backgroundEquipment: { items: [{ item_id: 99, name: 'Копьё', count: 1, typeId: 1, params: { magic_bonus: 0 } }], coins: { 3: 10 } },
      buyStartingEquipment: true,
      startingWallet: { 3: 25, 2: 4 },
      suggestValue: () => '',
    })

    expect(result.data.values.items.equipped).toEqual([
      { uid: 'worn_0', item_id: 501, count: 1, params: {}, override: null },
    ])
    expect(result.data.values.money.amounts).toMatchObject({ 2: 4, 3: 25 })
    expect(result.data.values.items.sections).toEqual([])
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

    expect(result.data.values.CON.value).toEqual({ base: 15, bonuses: [{ name: 'Стойкий ученик', title: 'Стойкий ученик', value: 1, readonly: true, sourceFeatKey: 'feat:70' }] })
    expect(result.data.values.hp.max).toBe(13)
    expect(result.data.values.proficiencies['Доспехи']).toContain('Средние доспехи')
    expect(result.data.values.DEX.skills['2'].up).toBe(1)
    expect(result.data.values.INT.save_up).toBe(true)
    expect(result.data.values.abilities_feats[0]).toMatchObject({ id: 70, count: 2, choices: { ability: [3] } })
  })
})
