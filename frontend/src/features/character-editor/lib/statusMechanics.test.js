import { describe, expect, it } from 'vitest'
import { ongoingDamageTransition, statusDamageHp } from './statusMechanics'
import { collectStatusDerivedEffects, withStatusEndEffects } from './characterStatuses'
import { collectCharacterCombatEffects, matchingWeaponDamageActions } from './characterCombatEffects'
import { selectedWeaponDamageExpression } from '../blocks/dnd/lib/weaponDamageAction'

describe('effect mechanics', () => {
  const config = { dice_count: 3, decrease_on_save: 1 }
  it('ends immediately on initial success and decreases later damage one die at a time', () => {
    const initial = ongoingDamageTransition(config, {}, 'damage')
    expect(initial.damage_phase).toBe('initial_save')
    expect(ongoingDamageTransition(config, initial, 'save', true)).toBeNull()
    let state = ongoingDamageTransition(config, initial, 'save', false)
    for (const remaining of [2, 1, 0]) {
      state = ongoingDamageTransition(config, state, 'damage')
      state = ongoingDamageTransition(config, state, 'save', true)
      expect(state?.damage_dice || 0).toBe(remaining)
    }
  })
  it('does not apply a weapon-targeted bonus before a weapon was chosen', () => {
    const values = { states: [{ uid: 'oil', effect_id: 1, params: {} }] }
    const items = new Map([['1', { id: 1, data: { derived_effects: [{ kind: 'weapon_attack_bonus', value: 3, target_parameter: 'weapon_uid' }] } }]])
    expect(collectStatusDerivedEffects(values, items)).toEqual([])
    values.states[0].params.weapon_uid = 'sword'
    expect(collectStatusDerivedEffects(values, items)[0].target_ids).toEqual(['sword'])
  })
  it('binds spell damage dice to the chosen weapon and freezes the slot bonus', () => {
    const values = { states: [{ uid: 'spell', effect_id: 1, params: { bonus: 3 } }] }
    const items = new Map([['1', { id: 1, data: { weapon_target: {}, weapon_damage: [
      { dice: 'd4', dice_count_parameter: 'bonus' },
    ] } }]])
    expect(collectCharacterCombatEffects(values, items).weaponDamage).toEqual([])
    values.states[0].params.weapon_uid = 'sword'
    const effects = collectCharacterCombatEffects(values, items)
    expect(matchingWeaponDamageActions(effects, { weaponUid: 'sword' })[0].dice_count).toBe(3)
    expect(matchingWeaponDamageActions(effects, { weaponUid: 'bow' })).toEqual([])
    values.states[0].external_only = true
    expect(collectCharacterCombatEffects(values, items).weaponDamage).toEqual([])
  })
  it('applies resistance once, absorbs temporary HP and does not go below zero', () => {
    expect(statusDamageHp({ current: 10, temp: 2 }, 9, [{ damage_type: 4, kind: 'resistance' }], 4)).toMatchObject({ current: 8, temp: 0 })
    expect(statusDamageHp({ current: 10, temp: 2 }, 99, [{ damage_type: 4, kind: 'immunity' }], 4)).toMatchObject({ current: 10, temp: 2 })
  })
  it('creates the follow-up effect only when its source actually ends', () => {
    const current = [{ uid: 'haste', effect_id: 1 }]
    const items = new Map([['1', { id: 1, data: { on_end_effect: { id: 2 } } }], ['2', { id: 2, data: { duration: { kind: 'rounds', value: 1 } } }]])
    expect(withStatusEndEffects(current, current, items)).toEqual(current)
    expect(withStatusEndEffects(current, [], items)[0]).toMatchObject({ effect_id: 2, duration: { kind: 'rounds', value: 1 } })
  })
  it('uses signed status damage in the same weapon menu and doubles dice on a critical', () => {
    const effects = collectCharacterCombatEffects({ states: [{ uid: 'small', effect_id: 1 }] }, new Map([['1', { id: 1, name: 'Уменьшение', data: { weapon_damage: [{ dice: 'd4', dice_count: 1, sign: '-' }] } }]]))
    const actions = matchingWeaponDamageActions(effects, {})
    expect(selectedWeaponDamageExpression({ baseExpression: '2d6+3', actions, actionKeys: [actions[0].key], critical: true })).toBe('2d6+3-2d4')
  })
})
