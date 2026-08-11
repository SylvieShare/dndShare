import { describe, expect, it } from 'vitest'
import {
  addHitDie,
  hitDiceFromClasses,
  normalizeHitDice,
  setHitDieUsed,
  withHitDice,
} from './hitDice'

describe('hit dice pools', () => {
  it('normalizes the canonical pool shape', () => {
    expect(normalizeHitDice({ hitDice: [{ die: 'd10', total: 4, used: 2 }] })).toEqual([
      { die: 'd10', total: 4, used: 2 },
    ])
  })

  it('groups equal dice without adding scalar mirrors', () => {
    const hp = withHitDice({}, [
      { die: 'd10', total: 2, used: 1 },
      { die: 'd6', total: 1, used: 0 },
      { die: 'd10', total: 1, used: 0 },
    ])

    expect(hp.hitDice).toEqual([
      { die: 'd10', total: 3, used: 1 },
      { die: 'd6', total: 1, used: 0 },
    ])
    expect(hp).not.toHaveProperty('dice')
    expect(hp).not.toHaveProperty('diceCount')
    expect(hp).not.toHaveProperty('diceUsed')
  })

  it('adds and spends a die in the selected type only', () => {
    const hp = addHitDie({ hitDice: [{ die: 'd10', total: 2, used: 0 }] }, 'd6')
    expect(setHitDieUsed(hp, 'd6', 1).hitDice).toEqual([
      { die: 'd10', total: 2, used: 0 },
      { die: 'd6', total: 1, used: 1 },
    ])
  })

  it('reconstructs a multiclass pool and preserves usage by die type', () => {
    const entries = [{ id: 1, level: 3 }, { id: 2, level: 2 }]
    const pools = hitDiceFromClasses(
      { hitDice: [{ die: 'd10', total: 3, used: 2 }, { die: 'd6', total: 2, used: 1 }] },
      entries,
      (entry) => entry.id === 1 ? 'd10' : 'd6',
    )
    expect(pools).toEqual([
      { die: 'd10', total: 3, used: 2 },
      { die: 'd6', total: 2, used: 1 },
    ])
  })
})
