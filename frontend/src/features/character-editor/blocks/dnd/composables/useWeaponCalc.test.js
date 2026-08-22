import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useWeaponCalc } from './useWeaponCalc'

describe('weapon critical damage', () => {
  it('doubles damage dice, keeps the flat modifier once and adds extra weapon dice', () => {
    const calc = useWeaponCalc({
      statsVar: ref({ 1: 3 }),
      profBonus: ref(2),
      diceMap: ref({ 1: 'd6' }),
      diceDetailsMap: ref({ 1: { value: 'd6', sides: 6 } }),
      damageTypeMap: ref({ 2: 'Рубящий' }),
      damageTypeDetailsMap: ref({ 2: { value: 'Рубящий' } }),
      item: () => ({ data: {} }),
      propertyItems: () => [],
      itemBaseAttacks: () => [{ count: 1, dice_id: 1, type: 2 }],
      itemTwoHandedAttacks: () => [],
    })
    const entry = { stat_suggest_id: 1, params: {}, add_attacks: [{ count: 1, dice_id: 1, type_suggest_id: 2 }] }
    expect(calc.criticalDamageExpression(entry, 1)).toBe('3d6{Рубящий}+2d6{Рубящий}+3{Рубящий}')
  })
})
