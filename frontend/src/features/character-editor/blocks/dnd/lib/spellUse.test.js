import { describe, expect, it } from 'vitest'
import { availableSpellSlotLevels, availableSpellSlotOptions } from './spellUse'

describe('spell use slot selection', () => {
  const slots = [
    { level: 1, total: 3, used: 3 },
    { level: 2, total: 2, used: 1 },
    { level: 3, total: 1, used: 0 },
  ]

  it('does not spend a slot for a cantrip', () => {
    expect(availableSpellSlotLevels(slots, 0)).toEqual([0])
  })

  it('offers only unspent slots at or above the spell level', () => {
    expect(availableSpellSlotLevels(slots, 1)).toEqual([2, 3])
    expect(availableSpellSlotLevels(slots, 3)).toEqual([3])
  })

  it('returns no choice when the character has no suitable slot', () => {
    expect(availableSpellSlotLevels(slots, 4)).toEqual([])
  })
})

describe('separate Pact Magic slots', () => {
  it('offers long- and short-rest slots independently, including at the same level', () => {
    const pools = {
      long_rest: [{ level: 3, total: 2, used: 1 }],
      short_rest: [{ level: 3, total: 2, used: 0 }],
    }
    expect(availableSpellSlotOptions(pools, 1)).toEqual([
      { pool: 'long_rest', level: 3, remaining: 1 },
      { pool: 'short_rest', level: 3, remaining: 2 },
    ])
  })

  it('allows a warlock spell to use an ordinary slot and another class spell to use pact magic', () => {
    expect(availableSpellSlotOptions({
      long_rest: [{ level: 2, total: 1, used: 0 }],
      short_rest: [{ level: 3, total: 1, used: 0 }],
    }, 2))
      .toHaveLength(2)
  })
})
