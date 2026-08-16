import { describe, expect, it } from 'vitest'
import {
  abilityModifiersBySuggest,
  weaponAbilityModifier,
  weaponAbilitySuggestId,
} from './weaponAbility'

const stats = { 1: 4, 2: 2, 3: 1, 4: 0, 5: -1, 6: -2 }

describe('automatic weapon ability', () => {
  it('uses Strength for an ordinary melee weapon', () => {
    expect(weaponAbilitySuggestId({}, { data: {} }, [], stats)).toBe(1)
    expect(weaponAbilityModifier({}, { data: {} }, [], stats)).toBe(4)
  })

  it('uses Dexterity for a ranged weapon', () => {
    const item = { data: { is_long_range: true } }
    expect(weaponAbilitySuggestId({}, item, [], stats)).toBe(2)
    expect(weaponAbilityModifier({}, item, [], stats)).toBe(2)
  })

  it('uses the larger live Strength or Dexterity modifier for finesse weapons', () => {
    const item = { data: { tags: [14] } }
    const properties = [{ id: 14, label: 'Фехтовальное' }]

    expect(weaponAbilitySuggestId({}, item, properties, stats)).toBe(1)
    expect(weaponAbilityModifier({}, item, properties, { ...stats, 2: 5 })).toBe(5)
  })

  it('lets finesse override the ranged default when Strength is larger', () => {
    const item = { data: { is_long_range: true, tags: [{ value: 'Фехтовальное' }] } }
    expect(weaponAbilitySuggestId({}, item, [], stats)).toBe(1)
  })

  it('keeps an explicitly selected ability as an override', () => {
    const entry = { stat_suggest_id: 2 }
    expect(weaponAbilitySuggestId(entry, { data: {} }, [], stats)).toBe(2)
    expect(weaponAbilityModifier(entry, { data: {} }, [], stats)).toBe(2)
  })

  it('derives live modifiers from current character values', () => {
    expect(abilityModifiersBySuggest({
      STR: { value: { base: 16, bonuses: [{ value: 2 }] } },
      DEX: { value: 14 },
    })).toMatchObject({ 1: 4, 2: 2, 3: 0 })
  })
})
