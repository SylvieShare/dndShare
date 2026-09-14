import { describe, expect, it } from 'vitest'
import { statusValueProjection } from './statusValueProjection'
import { collectCharacterDerivedEffects, derivedSpeedBonuses, matchingDerivedEffects } from './characterDerivedEffects'

describe('potion status mechanics', () => {
  it('raises strength without changing the saved base, and restores it on removal', () => {
    const values = { STR: { value: { base: 14, bonuses: [{ value: 2 }] } }, states: [{ effect_id: 1 }] }
    const items = new Map([['1', { id: 1, data: { derived_effects: [{ kind: 'ability_minimum', ability_ids: [1], value: 21 }] } }]])
    expect(statusValueProjection(values, items).STR.value.base).toBe(21)
    expect(values.STR.value.base).toBe(14)
    expect(statusValueProjection({ ...values, states: [] }, items).STR).toBe(values.STR)
    expect(statusValueProjection({ ...values, STR: { value: 24 } }, items).STR.value).toBe(24)
  })
  it('collects blessing dice for attacks and saves, and haste speed separately from flat bonuses', () => {
    const values = { states: [{ effect_id: 1 }] }
    const items = new Map([['1', { id: 1, data: { derived_effects: [{ kind: 'roll_bonus', formula: '1d4', scopes: ['attack', 'saving_throw'] }, { kind: 'speed_multiplier', value: 2 }] } }]])
    const rules = collectCharacterDerivedEffects(values, items)
    expect(matchingDerivedEffects(rules, 'roll_bonus', { kind: 'attack' })).toHaveLength(1)
    expect(matchingDerivedEffects(rules, 'roll_bonus', { kind: 'ability_check' })).toHaveLength(0)
    expect(derivedSpeedBonuses(rules).multiplier).toBe(2)
  })
})
