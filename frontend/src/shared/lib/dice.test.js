import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseDiceExpression, rollDiceExpression } from './dice'

afterEach(() => vi.restoreAllMocks())

describe('dice expression multiplication', () => {
  it('parses a multiplier as an explicit inline operator', () => {
    const parts = parseDiceExpression('1к6 × 5')

    expect(parts).toMatchObject([
      { operator: '+', sign: '+', kind: 'dice', n: 1, sides: 6 },
      { operator: '*', sign: '×', kind: 'flat', value: 5 },
    ])
  })

  it('rolls multiplication before addition', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    expect(rollDiceExpression('1к6 + 3 × 1к8').total).toBe(4)
    expect(rollDiceExpression('2к6 × 10 + 5').total).toBe(25)
    expect(rollDiceExpression('1к10 × 1к10').total).toBe(1)
  })
})
