import { describe, expect, it } from 'vitest'
import { impactBar } from './impactBar'

describe('damage bar', () => {
  it('highlights only lost HP, leaving temp absorption out of the red region', () => {
    expect(impactBar({ before: { current: 20, max: 20, temp: 2 }, after: { current: 7, max: 20 }, total: 15 })).toMatchObject({ lost: 13, remaining: 35, lossStart: 35, lossWidth: 65, labelCenter: 67.5 })
  })
  it('caps overkill at actual HP lost', () => {
    expect(impactBar({ before: { current: 5, max: 20 }, after: { current: 0, max: 20 }, total: 100 })).toMatchObject({ lost: 5, lossWidth: 25, lossStart: 0 })
  })
  it.each([20, 24])('has no damage region for unchanged HP or healing (%s)', current => {
    expect(impactBar({ before: { current: 20, max: 24 }, after: { current, max: 24 } }).lossWidth).toBe(0)
  })
  it('handles unknown HP without invalid percentages', () => {
    expect(impactBar({})).toEqual({ max: 0, lost: 0, remaining: 0, lossStart: 0, lossWidth: 0, labelCenter: 0 })
  })
})
