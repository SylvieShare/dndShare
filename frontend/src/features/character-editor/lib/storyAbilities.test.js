import { describe, expect, it } from 'vitest'
import { collectCharacterResources, restoreCharacterResources, resourceItemIds } from './characterResources'
import { collectCharacterDefenses } from './characterDefenses'
import { collectCharacterHpBonuses } from './characterHitPoints'
import { collectCharacterPassiveEffects } from './characterPassiveEffects'
import { collectCharacterDerivedEffects } from './characterDerivedEffects'
import { collectCharacterCombatEffects } from './characterCombatEffects'
import { collectCharacterFeatureActions } from './characterFeatureActions'
import { collectCharacterFeatureWidgets } from './characterFeatureWidgets'
import { abilitySpellGrantRows } from '../blocks/dnd/lib/abilitySpellGrants'

const item = { id: 901, typeId: 18, name: 'Дар хранителя', data: {
  max_use: 2, rollback_long_rest: true,
  granted_spells: [{ spell: 77, level: 1 }],
  choices: [{ key: 'gift', source: 'item', from_item_type_id: 5, grant_spells: true }],
  defenses: [{ damage_type: 1, kind: 'resistance' }],
  hp_bonuses: [{ base: 2 }], passive_effects: [{ title: 'Защита хранителя' }],
  derived_effects: [{ kind: 'speed_bonus', value: 5 }],
  roll_triggers: [{ event: 'natural_one', action: 'reroll' }],
  feature_actions: [{ key: 'bless', title: 'Благословить', action_type: 'action' }],
  sheet_widgets: [{ key: 'gift', kind: 'metric', value: '2' }],
} }
const items = new Map([['901', item]])
const values = { lvl: { level: 3 }, abilities_story: [{ id: 901, count: 1, choices: { gift: [78] } }] }

describe('story ability effects on character sheet', () => {
  it('feeds every standard ability effect collector', () => {
    expect(resourceItemIds(values)).toContain('901')
    expect(collectCharacterResources(values, items)[0]).toMatchObject({ total: 2, source: { valueId: 'abilities_story' } })
    expect(restoreCharacterResources(values, items, 'long').patch.abilities_story).toBeDefined()
    expect(collectCharacterDefenses(values, items)[0]).toMatchObject({ damage_type: 1, kind: 'resistance' })
    expect(collectCharacterHpBonuses(values, items)[0].value).toBe(2)
    expect(collectCharacterPassiveEffects(values, items)[0].title).toBe('Защита хранителя')
    expect(collectCharacterDerivedEffects(values, items)[0]).toMatchObject({ kind: 'speed_bonus', value: 5 })
    expect(collectCharacterCombatEffects(values, items).rollTriggers).toHaveLength(1)
    expect(collectCharacterFeatureActions(values, items)[0].title).toBe('Благословить')
    expect(collectCharacterFeatureWidgets(values, items)[0].value).toBe('2')
    expect(abilitySpellGrantRows([item], values).map(row => row.spellId).sort()).toEqual([77, 78])
  })

  it('removes all derived contributions after the ability is removed', () => {
    const empty = { ...values, abilities_story: [] }
    expect(collectCharacterResources(empty, items)).toEqual([])
    expect(collectCharacterDerivedEffects(empty, items)).toEqual([])
    expect(collectCharacterDefenses(empty, items)).toEqual([])
    expect(collectCharacterFeatureActions(empty, items)).toEqual([])
  })
})
