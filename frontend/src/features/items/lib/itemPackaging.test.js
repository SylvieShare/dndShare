import { describe, expect, it } from 'vitest'
import { inventoryItemEconomy, purchaseQuantity } from './itemPackaging'

const arrows = { data: { purchase_quantity: 20, cost: { value: 1, min: 1, max: 2, suggest_id: 3 }, weight: 1 } }
describe('packaged item economy', () => {
  it('calculates a partial stack without rounding away its weight or range', () => {
    expect(inventoryItemEconomy(arrows, { count: 13 })).toEqual({
      cost: { value: 0.65, min: 0.65, max: 1.3, suggest_id: 3 }, weight: 0.65,
    })
  })
  it('uses one piece by default and keeps missing economy unknown', () => {
    expect(inventoryItemEconomy(arrows).weight).toBe(0.05)
    expect(inventoryItemEconomy({ data: {} })).toEqual({ cost: null, weight: null })
    expect(purchaseQuantity({ data: {} })).toBe(1)
  })
  it('treats explicit instance overrides as values per piece', () => {
    expect(inventoryItemEconomy(arrows, { count: 2, override: { weight: 0.1, cost: { value: 10, suggest_id: 1 } } })).toEqual({
      cost: { value: 20, suggest_id: 1 }, weight: 0.2,
    })
  })
  it('preserves measured length pricing independently of purchase quantity', () => {
    const rope = { data: { purchase_quantity: 2, unit_cost_copper: 2, unit_weight: 0.2 } }
    expect(inventoryItemEconomy(rope, { count: 2, params: { length_ft: 30 } })).toEqual({
      cost: { value: 120, suggest_id: 1 }, weight: 12,
    })
  })
})
