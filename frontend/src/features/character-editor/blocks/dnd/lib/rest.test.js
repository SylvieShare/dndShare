import { describe, expect, it } from 'vitest'
import { longRestHp, longRestRecoveryCount, spendHitDie } from './rest'

const hp = {
  current: 8,
  max: 30,
  temp: 4,
  hitDice: [
    { die: 'd10', total: 3, used: 2 },
    { die: 'd6', total: 2, used: 2 },
  ],
}

describe('multiclass rests', () => {
  it('spends only the requested die type', () => {
    const result = spendHitDie({ ...hp, current: 10, hitDice: hp.hitDice.map((row) => ({ ...row, used: 0 })) }, 7, 'd6')
    expect(result.current).toBe(17)
    expect(result.hitDice).toEqual([
      { die: 'd10', total: 3, used: 0 },
      { die: 'd6', total: 2, used: 1 },
    ])
  })

  it('restores half the total dice using the chosen allocation', () => {
    expect(longRestRecoveryCount(hp)).toBe(2)
    const result = longRestHp(hp, { d10: 1, d6: 1 })
    expect(result).toMatchObject({ current: 30, temp: 0, diceCount: 5, diceUsed: 2 })
    expect(result.hitDice).toEqual([
      { die: 'd10', total: 3, used: 1 },
      { die: 'd6', total: 2, used: 1 },
    ])
  })
})
