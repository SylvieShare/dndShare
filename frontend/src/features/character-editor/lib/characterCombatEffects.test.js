import { describe, expect, it } from 'vitest'
import { collectCharacterCombatEffects, extraCriticalWeaponDice, matchingRollTriggers } from './characterCombatEffects'

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
})

