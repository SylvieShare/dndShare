import { describe, expect, it } from 'vitest'
import { statColumnOrder } from './statColumnOrder'

describe('characteristic column placement', () => {
  it('balances the six standard cards without dropping or duplicating a characteristic', () => {
    const heights = [150, 218, 116, 286, 286, 252]
    const order = statColumnOrder(heights, 2)
    expect([...order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5])
    expect(order.slice(0, 3).reduce((sum, index) => sum + heights[index], 0)).toBe(654)
    expect(order.slice(3).reduce((sum, index) => sum + heights[index], 0)).toBe(654)
    expect(statColumnOrder(heights, 1)).toEqual([0, 1, 2, 3, 4, 5])
  })
})
