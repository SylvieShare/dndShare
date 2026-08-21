import { describe, expect, it } from 'vitest'
import {
  cartCostCopper,
  copperToWallet,
  formatCopper,
  itemCostCopper,
  rollStartingWealth,
  startingWealthFormula,
} from './startingShop'

describe('PHB 2014 starting shop', () => {
  it('uses the class starting-wealth table and keeps every die result', () => {
    expect(startingWealthFormula('monk')).toBe('5к4 зм')
    expect(startingWealthFormula('fighter')).toBe('5к4 × 10 зм')
    expect(rollStartingWealth('fighter', () => 0)).toEqual({
      classKey: 'fighter', rolls: [1, 1, 1, 1, 1], multiplier: 10, gold: 50,
    })
  })

  it('normalizes mixed PHB coin costs to copper', () => {
    const silverItem = { data: { cost: { value: 5, suggest_id: 2 } } }
    const goldItem = { data: { cost: { value: 1.5, suggest_id: 3 } } }
    expect(itemCostCopper(silverItem)).toBe(50)
    expect(itemCostCopper(goldItem)).toBe(150)
    expect(cartCostCopper([{ ...silverItem, count: 2 }, { ...goldItem, count: 1 }])).toBe(250)
  })

  it('prices measured gear from its instance length', () => {
    const rope = { data: { cost: { value: 1, suggest_id: 3 }, unit_cost_copper: 2 }, params: { length_ft: 30 } }
    expect(itemCostCopper(rope)).toBe(60)
  })

  it('formats change and stores it in the canonical wallet denominations', () => {
    expect(formatCopper(1234)).toBe('12 зм 3 см 4 мм')
    expect(copperToWallet(1234)).toEqual({ 1: 4, 2: 3, 3: 12 })
  })
})
