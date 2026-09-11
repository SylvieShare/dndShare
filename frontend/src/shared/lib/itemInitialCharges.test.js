import { expect, it } from 'vitest'
import { reactive } from 'vue'
import { hasInitialChargeStock, initialChargeDefault, initialChargeRuleError, initializeItemCharges, validChargeCount } from './itemInitialCharges'
import { abilityHasResources, abilityUseTotal } from './dndAbilityUses'
const rule = { mode: 'roll', formula: '1к8+1' }
it('requires an explicit initial result, including a valid zero, without mutating reactive input', () => {
  const params = reactive({ weapon_base_item_id: 49, magic: { attuned: true } })
  const next = initializeItemCharges(params, 0)
  expect(next).toEqual({ weapon_base_item_id: 49, magic: { attuned: true, max_use: 0, remaining: 0 } })
  expect(hasInitialChargeStock(next)).toBe(true)
  expect(params.magic.max_use).toBeUndefined()
  expect(abilityUseTotal({ initial_charges: rule })).toBeNull()
  expect(abilityHasResources({ initial_charges: rule })).toBe(true)
  expect(abilityUseTotal({ initial_charges: rule }, {}, next.magic)).toBe(0)
})
it('never refills on reopening and gives separate instances independent state', () => {
  const first = initializeItemCharges({}, 7), second = initializeItemCharges({}, 3)
  first.magic.remaining = 0
  expect(initializeItemCharges(reactive(first), 9)).toEqual(first)
  expect(second.magic).toEqual({ max_use: 3, remaining: 3 })
  expect(initialChargeDefault(rule)).toBe('')
  expect(initialChargeDefault({ mode: 'fixed', value: 4 })).toBe(4)
})
it('validates bounded integral stocks and positive additive formulas', () => {
  for (const n of ['', null, undefined, ' ', -1, 1.5, 101, Infinity, 'oops']) expect(validChargeCount(n)).toBe(false)
  for (const f of ['1к8+1', '2D6 + 3', 'd20', '0', '100', '1к4−1', '1d8-1']) expect(initialChargeRuleError({ mode: 'roll', formula: f })).toBe('')
  for (const f of ['0d8', '1d1', '101', '100d100', '1d8-2', '1d4-1d8', 'oops', '']) expect(initialChargeRuleError({ mode: 'roll', formula: f })).not.toBe('')
  expect(initialChargeRuleError({ mode: 'fixed', value: 0 })).toBe('')
})
