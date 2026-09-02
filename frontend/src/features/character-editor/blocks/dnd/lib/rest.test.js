import { describe, expect, it } from 'vitest'
import { longRestHp, longRestRecoveryCount, longRestSpells, shortRestSpells, spendHitDie } from './rest'

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
    expect(result).toMatchObject({ current: 30, temp: 0 })
    expect(result.hitDice).toEqual([
      { die: 'd10', total: 3, used: 1 },
      { die: 'd6', total: 2, used: 1 },
    ])
  })
})

describe('multiclass spell-slot recovery', () => {
  const spells = {
    slot_pools: {
      long_rest: [{ level: 1, total: 4, used: 2 }],
      short_rest: [{ level: 2, total: 2, used: 1 }, { level: 3, total: 1, used: 1 }],
    },
  }

  it('restores only Pact Magic on a short rest', () => {
    expect(shortRestSpells(spells)).toMatchObject({
      slot_pools: {
        long_rest: [{ level: 1, total: 4, used: 2 }],
        short_rest: [{ level: 2, total: 2, used: 0 }, { level: 3, total: 1, used: 0 }],
      },
    })
  })

  it('restores both pools on a long rest', () => {
    expect(longRestSpells(spells)).toMatchObject({
      slot_pools: {
        long_rest: [{ level: 1, total: 4, used: 0 }],
        short_rest: [{ level: 2, total: 2, used: 0 }, { level: 3, total: 1, used: 0 }],
      },
    })
  })
})
