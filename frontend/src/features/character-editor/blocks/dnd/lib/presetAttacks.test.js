import { describe, expect, it } from 'vitest'
import {
  improvisedWeaponAttackBonus,
  PRESET_ATTACK_ART_ITEM_IDS,
  presetDamageExpression,
  unarmedStrikeAttackBonus,
  unarmedStrikeDamage,
} from './presetAttacks'

describe('preset attacks', () => {
  it('reuses system weapon artwork without importing raster assets into the app', () => {
    expect(PRESET_ATTACK_ART_ITEM_IDS).toEqual({ unarmed: 64, improvised: 35 })
  })

  it('adds proficiency to an unarmed strike but not to a generic improvised weapon', () => {
    expect(unarmedStrikeAttackBonus(-1, 3)).toBe(2)
    expect(improvisedWeaponAttackBonus(-1)).toBe(-1)
  })

  it('allows zero, but never negative, unarmed damage', () => {
    expect(unarmedStrikeDamage(-1)).toBe(0)
    expect(unarmedStrikeDamage(-3)).toBe(0)
    expect(presetDamageExpression('unarmed', -1)).toBe('0{Дробящий}')
  })

  it('doubles the improvised weapon die on a critical hit', () => {
    expect(presetDamageExpression('improvised', -1)).toBe('1d4{Дробящий}-1{Дробящий}')
    expect(presetDamageExpression('improvised', -1, true)).toBe('2d4{Дробящий}-1{Дробящий}')
  })
})
