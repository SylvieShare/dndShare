import { describe, expect, it } from 'vitest'
import { spellInstances, spellScalingHint, spellScalingSteps } from './spellScaling'
import { spellRollOptions } from './spellRollOptions'
import { useSpellCalc } from '../composables/useSpellCalc'
const calc = useSpellCalc({ diceMap: { value: { d4: 'd4', d6: 'd6', d8: 'd8', d10: 'd10' } }, diceDetailsMap: { value: {} }, damageTypeMap: { value: {} }, schoolMap: { value: {} } })

describe('spell progression', () => {
  it('adds healing dice for the spent slot but adds the ability modifier only once', () => {
    const item = { data: { lvl: 1, heal: { add_mod: true, scaling: 'slot', dices: [{ count: 1, dice_id: 'd4' }], addon: [{ count: 1, dice_id: 'd4' }] } } }
    expect(calc.healDiceParts(item, 3, 1, 4)[0]).toMatchObject({ count: 3, bonus: 4 })
    expect(calc.healDiceParts(item, 1, 20, -1)[0]).toMatchObject({ count: 1, bonus: -1 })
    expect(spellScalingHint(item)).toBe('+1к4 за каждый круг ячейки выше 1-го')
  })
  it('supports a two-slot growth interval and an ability modifier for damage', () => {
    const item = { data: { lvl: 2, damage: { scaling: 'slot', scaling_step: 2, add_mod: true, dices: [{ count: 1, dice_id: 'd8' }], addon: [{ count: 1, dice_id: 'd8' }] } } }
    expect([2, 3, 4, 5, 6].map(level => calc.damageDiceParts(item, level, 20, 3)[0].count)).toEqual([1, 1, 2, 2, 3])
    expect(calc.damageDiceParts(item, 4, 20, 3)[0].bonus).toBe(3)
  })
  it('grows flat amounts and addon bonuses without manufacturing a die', () => {
    const item = { data: { lvl: 6, heal: { scaling: 'slot', dices: [{ bonus: 70 }], addon: [{ bonus: 10 }] } } }
    expect(calc.healDiceParts(item, 9, 1)[0]).toMatchObject({ bonus: 100, diceLabel: '' })
    const mixed = { data: { lvl: 1, heal: { scaling: 'slot', dices: [{ dice_id: 'd8', count: 1, bonus: 5 }], addon: [{ dice_id: 'd8', count: 1, bonus: 5 }] } } }
    expect(calc.healDiceParts(mixed, 3)[0]).toMatchObject({ count: 3, bonus: 15 })
  })
  it('grows ray counts separately from damage per ray', () => {
    const eldritch = { data: { lvl: 0, damage: { scaling: 'cantrip', instances: 1, addon_instances: 1, dices: [{ dice_id: 'd10', count: 1 }] } } }
    expect([1, 5, 11, 17].map(level => spellInstances(eldritch, 0, level))).toEqual([1, 2, 3, 4])
    expect(calc.damageDiceParts(eldritch, 0, 17)[0].count).toBe(1)
    const missile = { data: { lvl: 1, damage: { scaling: 'slot', instances: 3, addon_instances: 1 } } }
    expect(spellInstances(missile, 3, 1)).toBe(5)
  })
  it('caps hail of thorns and supports shadow blade thresholds', () => {
    const capped = { scaling: 'slot', scaling_max_steps: 5 }
    expect(spellScalingSteps(capped, 1, 9, 20)).toBe(5)
    const thresholds = { scaling: 'slot', scaling_levels: [{ level: 3 }, { level: 5 }, { level: 7 }] }
    expect([2, 3, 4, 5, 6, 7, 8, 9].map(level => spellScalingSteps(thresholds, 2, level, 20))).toEqual([0, 1, 1, 2, 2, 3, 3, 3])
  })
  it('keeps attack damage, save damage and hit-point pools separate', () => {
    const entry = { item: { id: 599, name: 'Ледяной кинжал', data: { lvl: 1, damage: { range_attack: true }, rolls: [
      { label: 'Попадание', kind: 'damage', range_attack: true, dices: [{ count: 1, dice_id: 'd10' }] },
      { label: 'Взрыв', kind: 'damage', scaling: 'slot', dices: [{ count: 2, dice_id: 'd6' }], addon: [{ count: 1, dice_id: 'd6' }] },
    ] } } }
    const options = spellRollOptions(entry)
    expect(options).toHaveLength(2)
    expect(calc.damageDiceParts(options[0].entry.item, 3)[0].count).toBe(1)
    expect(calc.damageDiceParts(options[1].entry.item, 3)[0].count).toBe(4)
    const pool = spellRollOptions({ item: { data: { lvl: 1, rolls: [{ kind: 'effect', label: 'Хиты', dices: [{ count: 5, dice_id: 'd8' }] }] } } })[0]
    expect(pool.kind).toBe('effect')
  })

})
