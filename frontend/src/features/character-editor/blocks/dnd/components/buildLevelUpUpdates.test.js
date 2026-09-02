import { describe, expect, it } from 'vitest'

import { buildLevelUpUpdates } from './buildLevelUpUpdates'

describe('buildLevelUpUpdates granted spells', () => {
  it('unlocks a leveled racial spell with its own casting ability', () => {
    const drowMagic = {
      id: 4087,
      name: 'Дроуская магия',
      data: {
        granted_spells: [
          { spell: { id: 511 }, level: 1, ability: 6 },
          { spell: { id: 627 }, level: 3, ability: 6, slotless: true },
        ],
      },
    }
    const updates = buildLevelUpUpdates({
      values: {
        lvl: { level: 2 },
        hp: { max: 10, current: 10, hitDice: [{ die: 'd8', total: 2, used: 0 }] },
        abilities_race: [{ id: 4087 }],
        spells: {
          schema_version: 2, slots_auto: true, slot_pools: { long_rest: [], short_rest: [] }, tabs: [],
          grants: [{ key: 'ability:4087:spell:511', id: 511, casting_ability: 6, source: { kind: 'ability', item_id: 4087, label: 'Дроуская магия' } }],
        },
      },
      newTotal: 3,
      isPlain: false,
      entriesAfter: [{ id: 1, name: 'Воин', level: 3 }],
      features: [],
      itemsById: { 1: {}, 4087: drowMagic },
      hitDieLabelOf: () => 'd8',
      hitDieLabel: 'd8',
      hpGain: 5,
      asiNow: false,
      asiSkipped: true,
      asiMode: 'asi',
      featPick: null,
      suggestItems: () => [],
      asiStats: [],
      asiDelta: 0,
      featureChoiceSelections: {},
      applySlots: false,
      slotDiff: [],
      slotsAfter: null,
      grantedNewIds: [],
      classItem: {},
    })

    expect(updates.spells.grants.find((entry) => entry.id === 627)).toMatchObject({
      key: 'ability:4087:spell:627',
      casting_ability: 6,
      slotless: true,
      source: { kind: 'ability', item_id: 4087, label: 'Дроуская магия' },
    })
  })

  it('stores class-granted spells separately without changing learned spells', () => {
    const updates = buildLevelUpUpdates({
      values: {
        lvl: { level: 1 },
        hp: { max: 10, current: 10, hitDice: [{ die: 'd8', total: 1, used: 0 }] },
        spells: {
          schema_version: 2, slots_auto: true, slot_pools: { long_rest: [], short_rest: [] },
          tabs: [{ key: 'class:1', name: 'Жрец', class_item_id: 1, casting_ability: 5, mode: 'prepared', save_bonus: 0, attack_bonus: 0, spells: [{ key: 'spell:5', id: 5, prepared: false }] }],
          grants: [],
        },
      },
      newTotal: 2,
      isPlain: false,
      entriesAfter: [{ id: 1, name: 'Жрец', level: 2 }],
      features: [],
      itemsById: { 1: {} },
      hitDieLabelOf: () => 'd8',
      hitDieLabel: 'd8',
      hpGain: 5,
      asiNow: false,
      asiSkipped: true,
      asiMode: 'asi',
      featPick: null,
      suggestItems: () => [],
      asiStats: [],
      asiDelta: 0,
      featureChoiceSelections: {},
      applySlots: false,
      slotDiff: [],
      slotsAfter: null,
      grantedNewIds: [5, 6, 7],
      classItem: { id: 1, name: 'Жрец' },
    })

    expect(updates.spells.tabs[0].spells).toEqual([{ key: 'spell:5', id: 5, prepared: false }])
    expect(updates.spells.grants).toEqual([
      { key: 'class:1:spell:5', id: 5, source: { kind: 'class', item_id: 1, label: 'Жрец' } },
      { key: 'class:1:spell:6', id: 6, source: { kind: 'class', item_id: 1, label: 'Жрец' } },
      { key: 'class:1:spell:7', id: 7, source: { kind: 'class', item_id: 1, label: 'Жрец' } },
    ])
  })
})

describe('buildLevelUpUpdates feature choices', () => {
  it('stores all selections on a newly granted class ability', () => {
    const feature = {
      id: 42,
      data: { choices: [
        { key: 'style', options: [{ value: 'defense', label: 'Защита' }] },
        { key: 'tool', from_suggest_id: 5 },
      ] },
    }
    const updates = buildLevelUpUpdates({
      values: { lvl: { level: 1 }, hp: { max: 10, current: 10 }, abilities_class: [] },
      newTotal: 2,
      isPlain: false,
      entriesAfter: [{ id: 1, name: 'Воин', level: 2 }],
      features: [feature],
      itemsById: { 1: {}, 42: feature },
      hitDieLabelOf: () => 'd10',
      hitDieLabel: 'd10',
      hpGain: 6,
      asiNow: false,
      asiSkipped: true,
      asiMode: 'asi',
      featPick: null,
      suggestItems: () => [],
      asiStats: [],
      asiDelta: 0,
      featureChoiceSelections: { '42:style': ['defense'], '42:tool': [7] },
      applySlots: false,
      slotDiff: [],
      slotsAfter: null,
      grantedNewIds: [],
      classItem: {},
    })

    expect(updates.abilities_class).toEqual([{
      id: 42,
      count: 0,
      choices: { style: ['defense'], tool: [7] },
    }])
  })
})

describe('buildLevelUpUpdates subclass grants', () => {
  it('applies subclass tool proficiencies and its casting ability', () => {
    const updates = buildLevelUpUpdates({
      values: {
        lvl: { level: 2 }, hp: { max: 15, current: 15 }, proficiencies: { Инструменты: [] },
        spells: {
          schema_version: 2, slots_auto: true, slot_pools: { long_rest: [], short_rest: [] }, grants: [],
          tabs: [{ key: 'class:1', name: 'Плут', class_item_id: 1, casting_ability: 4, mode: 'known', save_bonus: 1, attack_bonus: 0, spells: [{ key: 'spell:50', id: 50, prepared: false }] }],
        },
      },
      newTotal: 3,
      isPlain: false,
      entriesAfter: [{ id: 1, name: 'Плут', level: 3, subclass: { id: 2, name: 'Убийца' } }],
      features: [],
      itemsById: { 1: {}, 2: {} },
      hitDieLabelOf: () => 'd8', hitDieLabel: 'd8', hpGain: 5,
      asiNow: false, asiSkipped: true, asiMode: 'asi', featPick: null,
      suggestItems: (typeId) => typeId === 5 ? [{ id: 24, value: 'Набор для грима' }] : [],
      asiStats: [], asiDelta: 0, featureChoiceSelections: {},
      applySlots: true, slotDiff: [{ level: 1, from: 0, to: 2 }],
      slotsAfter: { totals: [2, 0, 0, 0, 0, 0, 0, 0, 0], isCaster: true },
      grantedNewIds: [], classItem: { data: {} },
      subclassItem: { data: { tool_prof: [24], spellcasting: { ability: 4 } } },
      subclassSelectedNow: true,
      classSpellSelection: {
        tab: { key: 'class:1', name: 'Плут', class_item_id: 1, casting_ability: 4, mode: 'known', save_bonus: 1, attack_bonus: 0, spells: [] },
        entries: [{ id: 50, key: 'spell:50', level: 1 }],
      },
    })

    expect(updates.proficiencies['Инструменты']).toEqual(['Набор для грима'])
    expect(updates.spells.tabs).toHaveLength(1)
    expect(updates.spells.tabs[0]).toMatchObject({ key: 'class:1', class_item_id: 1, casting_ability: 4, save_bonus: 1 })
    expect(updates.spells.tabs[0].spells).toEqual([{ key: 'spell:50', id: 50, prepared: false }])
  })
})

describe('buildLevelUpUpdates class spell selection', () => {
  it('creates paladin spell settings and assigns selected spells at level two', () => {
    const updates = buildLevelUpUpdates({
      values: { lvl: { level: 1 }, hp: { max: 12, current: 12 } },
      newTotal: 2, isPlain: false,
      entriesAfter: [{ id: 2, name: 'Паладин', level: 2 }],
      features: [], itemsById: { 2: {} },
      hitDieLabelOf: () => 'd10', hitDieLabel: 'd10', hpGain: 6,
      asiNow: false, asiSkipped: true, asiMode: 'asi', featPick: null,
      suggestItems: () => [], asiStats: [], asiDelta: 0, featureChoiceSelections: {},
      applySlots: true, slotDiff: [{ level: 1, from: 0, to: 2 }],
      slotsAfter: { totals: [2, 0, 0, 0, 0, 0, 0, 0, 0], isCaster: true },
      grantedNewIds: [], classItem: { data: { spellcasting_ability: 6 } },
      classSpellSelection: {
        tab: { key: 'class:2', name: 'Паладин', class_item_id: 2, casting_ability: 6, mode: 'prepared', save_bonus: 0, attack_bonus: 0, spells: [] },
        entries: [{ id: 100, level: 1 }],
      },
    })

    expect(updates.spells.tabs[0]).toMatchObject({ class_item_id: 2, casting_ability: 6, mode: 'prepared' })
    expect(updates.spells.tabs[0].spells).toMatchObject([{ id: 100, prepared: true }])
  })
})

describe('buildLevelUpUpdates multiclass grants', () => {
  it('adds only missing fixed paladin proficiencies and preserves existing buckets', () => {
    const updates = buildLevelUpUpdates({
      values: {
        lvl: { level: 2 }, hp: { max: 15, current: 15 },
        proficiencies: {
          'Доспехи': ['Лёгкие доспехи'],
          'Оружие': ['Простое оружие'],
          'Языки': ['Общий'],
        },
      },
      newTotal: 3, isPlain: false, isMulticlass: true,
      entriesAfter: [{ id: 1, name: 'Волшебник', level: 2 }, { id: 2, name: 'Паладин', level: 1 }],
      features: [], itemsById: { 1: {}, 2: {} },
      hitDieLabelOf: () => 'd10', hitDieLabel: 'd10', hpGain: 6,
      asiNow: false, asiSkipped: true, asiMode: 'asi', featPick: null,
      suggestItems: () => [], asiStats: [], asiDelta: 0, featureChoiceSelections: {},
      applySlots: false, slotDiff: [], slotsAfter: null, grantedNewIds: [],
      classItem: { nameEn: 'Paladin', data: {} },
    })

    expect(updates.proficiencies).toEqual({
      'Доспехи': ['Лёгкие доспехи', 'Средние доспехи', 'Щиты'],
      'Оружие': ['Простое оружие', 'Воинское оружие'],
      'Языки': ['Общий'],
    })
  })

  it('does not apply the full-class proficiency table outside multiclassing', () => {
    const updates = buildLevelUpUpdates({
      values: { lvl: { level: 1 }, hp: { max: 10, current: 10 }, proficiencies: {} },
      newTotal: 2, isPlain: false, isMulticlass: false,
      entriesAfter: [{ id: 2, name: 'Паладин', level: 2 }], features: [], itemsById: { 2: {} },
      hitDieLabelOf: () => 'd10', hitDieLabel: 'd10', hpGain: 6,
      asiNow: false, asiSkipped: true, asiMode: 'asi', featPick: null,
      suggestItems: () => [], asiStats: [], asiDelta: 0, featureChoiceSelections: {},
      applySlots: false, slotDiff: [], slotsAfter: null, grantedNewIds: [],
      classItem: { nameEn: 'Paladin', data: {} },
    })

    expect(updates.proficiencies).toBeUndefined()
  })

  it('keeps multiclass grants when a level-one subclass grants another proficiency', () => {
    const updates = buildLevelUpUpdates({
      values: { lvl: { level: 2 }, hp: { max: 15, current: 15 }, proficiencies: {} },
      newTotal: 3, isPlain: false, isMulticlass: true,
      entriesAfter: [{ id: 1, name: 'Волшебник', level: 2 }, { id: 2, name: 'Жрец', level: 1 }],
      features: [], itemsById: { 1: {}, 2: {} },
      hitDieLabelOf: () => 'd8', hitDieLabel: 'd8', hpGain: 5,
      asiNow: false, asiSkipped: true, asiMode: 'asi', featPick: null,
      suggestItems: (typeId) => typeId === 4 ? [{ id: 30, value: 'Боевые молоты' }] : [],
      asiStats: [], asiDelta: 0, featureChoiceSelections: {},
      applySlots: false, slotDiff: [], slotsAfter: null, grantedNewIds: [],
      classItem: { nameEn: 'Cleric', data: {} },
      subclassItem: { data: { weapon_prof: [30] } },
      subclassSelectedNow: true,
    })

    expect(updates.proficiencies['Доспехи']).toEqual(['Лёгкие доспехи', 'Средние доспехи', 'Щиты'])
    expect(updates.proficiencies['Оружие']).toEqual(['Боевые молоты'])
  })
})
