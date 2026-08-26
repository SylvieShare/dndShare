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
        spells: { spells: [{ id: 511, prepared: false }], slots: [] },
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

    expect(updates.spells.spells.find((entry) => entry.id === 627)).toMatchObject({
      external_only: true,
      casting_ability: 6,
      slotless: true,
      granted_by: [{ kind: 'ability', item_id: 4087, label: 'Дроуская магия' }],
    })
  })

  it('marks leveled archetype spells permanent without preparing granted cantrips', () => {
    const updates = buildLevelUpUpdates({
      values: {
        lvl: { level: 1 },
        hp: { max: 10, current: 10, hitDice: [{ die: 'd8', total: 1, used: 0 }] },
        spells: { spells: [{ id: 5, prepared: false }], slots: [] },
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
      grantedSpellLevels: { 5: 1, 6: 1, 7: 0 },
      classItem: {},
    })

    expect(updates.spells.spells).toEqual([
      { id: 5, prepared: true, always_prepared: true },
      { id: 6, prepared: true, always_prepared: true },
      { id: 7, prepared: false },
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
          source_settings: { 'class:1:': { stat_path: 4, save_bonus: 1, attack_bonus: 0, preparation: false } },
          spells: [{ id: 50, spellcasting_source: 'class:1:' }], slots: [],
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
        sourceKey: 'class:1:2', sourceAliases: ['class:1:'], prepares: false, entries: [{ id: 50, level: 1 }],
      },
    })

    expect(updates.proficiencies['Инструменты']).toEqual(['Набор для грима'])
    expect(updates.spells.source_settings['class:1:2']).toMatchObject({ stat_path: 4, save_bonus: 1 })
    expect(updates.spells.source_settings['class:1:']).toBeUndefined()
    expect(updates.spells.spells[0].spellcasting_source).toBe('class:1:2')
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
        sourceKey: 'class:2:', prepares: true, entries: [{ id: 100, level: 1 }],
      },
    })

    expect(updates.spells.source_settings['class:2:']).toMatchObject({ stat_path: 6, preparation: true })
    expect(updates.spells.spells).toEqual([
      { id: 100, prepared: true, spellcasting_source: 'class:2:' },
    ])
  })
})
