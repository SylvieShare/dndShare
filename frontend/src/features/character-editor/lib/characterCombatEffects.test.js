import { describe, expect, it } from 'vitest'
import {
  collectCharacterCombatEffects,
  extraCriticalWeaponDice,
  matchingRollTriggers,
  matchingWeaponDamageActions,
} from './characterCombatEffects'

describe('character combat effects', () => {
  const items = new Map([
    ['1', { id: 1, name: 'Везучий', data: { roll_triggers: [{ event: 'natural_one', action: 'reroll', scopes: ['attack'] }] } }],
    ['2', { id: 2, name: 'Свирепые атаки', data: { critical_damage: [{ weapon_kind: 'melee', extra_weapon_dice: 1 }] } }],
  ])
  const effects = collectCharacterCombatEffects({ lvl: { level: 1 }, abilities_race: [{ id: 1 }, { id: 2 }] }, items)

  it('filters roll triggers by context', () => {
    expect(matchingRollTriggers(effects, 'attack')).toHaveLength(1)
    expect(matchingRollTriggers(effects, 'initiative')).toHaveLength(0)
  })

  it('applies critical modifiers only to matching weapons', () => {
    expect(extraCriticalWeaponDice(effects, { melee: true })).toBe(1)
    expect(extraCriticalWeaponDice(effects, { melee: false })).toBe(0)
  })

  it('resolves level-scaled weapon damage only for eligible weapons', () => {
    const rogueItems = new Map([['3', {
      id: 3,
      name: 'Скрытая атака',
      data: {
        class_ids: [{ id: 10 }],
        weapon_damage: [{ dice: 'd6', dice_count_level_divisor: 2, dice_count_rounding: 'up', weapon_kind: 'finesse_or_ranged' }],
      },
    }]])
    const rogueEffects = collectCharacterCombatEffects({
      lvl: { level: 5 },
      classes: [{ id: 10, level: 5 }],
      abilities_class: [{ id: 3 }],
    }, rogueItems)

    expect(matchingWeaponDamageActions(rogueEffects, { finesse: true })).toMatchObject([{ dice: 'd6', dice_count: 3 }])
    expect(matchingWeaponDamageActions(rogueEffects, { ranged: true })).toHaveLength(1)
    expect(matchingWeaponDamageActions(rogueEffects, { melee: true })).toHaveLength(0)
  })
})
