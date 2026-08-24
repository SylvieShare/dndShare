import { describe, expect, it } from 'vitest'
import {
  collectCharacterDefenses,
  createAbilityDefenseSource,
  createManualDefenseSource,
  defenseItemIds,
} from './characterDefenses'

describe('character defenses', () => {
  it('combines editable rows with readonly ability defenses', () => {
    const sources = [
      createManualDefenseSource(),
      createAbilityDefenseSource('abilities_race'),
    ]
    const values = {
      lvl: { level: 3 },
      defenses: [{ damage_type: 13, kind: 'vulnerability' }],
      abilities_race: [{ id: 44 }],
    }
    const items = new Map([['44', {
      id: 44,
      name: 'Адское сопротивление',
      data: { defenses: [{ damage_type: 5, kind: 'resistance' }] },
    }]])

    expect(collectCharacterDefenses(values, items, sources)).toEqual([
      expect.objectContaining({ damage_type: 13, kind: 'vulnerability', readonly: false }),
      expect.objectContaining({
        damage_type: 5,
        kind: 'resistance',
        readonly: true,
        source_label: 'способность «Адское сопротивление»',
      }),
    ])
  })

  it('respects level-gated definitions and exposes ids for hydration', () => {
    const source = createAbilityDefenseSource('abilities_class')
    const values = { lvl: { level: 2 }, abilities_class: [{ id: 7 }, { id: 7 }] }
    const items = new Map([['7', {
      id: 7,
      name: 'Защита',
      data: { defenses: [{ damage_type: 4, kind: 'immunity', level: 3 }] },
    }]])

    expect(defenseItemIds(values, [source])).toEqual(['7'])
    expect(collectCharacterDefenses(values, items, [source])).toEqual([])
    values.lvl.level = 3
    expect(collectCharacterDefenses(values, items, [source])).toHaveLength(2)
  })

  it('derives a defense from a choice stored on another owned ability', () => {
    const source = createAbilityDefenseSource('abilities_race')
    const values = { abilities_race: [
      { id: 10, choices: { ancestry: ['red'] } },
      { id: 11 },
    ] }
    const items = new Map([
      ['10', { id: 10, name: 'Оружие дыхания', data: {} }],
      ['11', { id: 11, name: 'Сопротивление урону', data: { choice_defenses: [{
        source_item_id: 10,
        choice_key: 'ancestry',
        options: [{ value: 'red', damage_type: 5, kind: 'resistance' }],
      }] } }],
    ])

    expect(collectCharacterDefenses(values, items, [source])).toMatchObject([{
      damage_type: 5,
      kind: 'resistance',
      readonly: true,
    }])
  })

  it('shows defenses contributed by an active status effect', () => {
    const values = { states: [{ uid: 'rage', effect_id: 100 }] }
    const items = new Map([['100', {
      id: 100,
      name: 'Ярость',
      data: { defenses: [{ damage_type: 3, kind: 'resistance' }] },
    }]])
    expect(collectCharacterDefenses(values, items, [])).toMatchObject([{
      damage_type: 3,
      kind: 'resistance',
      readonly: true,
    }])
  })
})
