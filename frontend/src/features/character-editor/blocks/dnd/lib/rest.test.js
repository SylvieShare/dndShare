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


describe('passive hit point contributions during rest', () => {
  it('heals to the effective maximum without storing readonly feature bonuses', () => {
    const hp = { current: 8, max: { base: 20, bonuses: [] }, hitDice: [{ die: 'd8', total: 4, used: 1 }] }
    const rested = longRestHp(hp, null, '2014', 28)
    expect(rested.current).toBe(28)
    expect(rested.max).toEqual(hp.max)
    const spent = spendHitDie(hp, 100, 'd8', 28)
    expect(spent.current).toBe(28)
    expect(spent.max).toEqual(hp.max)
  })
})
