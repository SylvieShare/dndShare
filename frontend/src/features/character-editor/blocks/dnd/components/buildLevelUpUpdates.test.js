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
