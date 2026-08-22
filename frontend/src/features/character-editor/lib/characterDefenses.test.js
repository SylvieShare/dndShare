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
})
