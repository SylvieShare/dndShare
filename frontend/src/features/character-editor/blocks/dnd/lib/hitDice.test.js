import { describe, expect, it } from 'vitest'
import {
  addHitDie,
  hitDiceFromClasses,
  normalizeHitDice,
  setHitDieUsed,
  withHitDice,
} from './hitDice'

describe('hit dice pools', () => {
  it('reads the legacy scalar shape as one pool', () => {
    expect(normalizeHitDice({ dice: 'd10', diceCount: 4, diceUsed: 2 })).toEqual([
      { die: 'd10', total: 4, used: 2 },
    ])
  })

  it('groups equal dice and keeps aggregate legacy mirrors', () => {
    const hp = withHitDice({}, [
      { die: 'd10', total: 2, used: 1 },
      { die: 'd6', total: 1, used: 0 },
      { die: 'd10', total: 1, used: 0 },
    ])

    expect(hp.hitDice).toEqual([
      { die: 'd10', total: 3, used: 1 },
      { die: 'd6', total: 1, used: 0 },
    ])
    expect(hp).toMatchObject({ dice: 'd10', diceCount: 4, diceUsed: 1 })
  })

  it('adds and spends a die in the selected type only', () => {
    const hp = addHitDie({ hitDice: [{ die: 'd10', total: 2, used: 0 }] }, 'd6')
    expect(setHitDieUsed(hp, 'd6', 1).hitDice).toEqual([
      { die: 'd10', total: 2, used: 0 },
      { die: 'd6', total: 1, used: 1 },
    ])
  })

  it('reconstructs a legacy multiclass pool and assigns old usage to its old die first', () => {
    const entries = [{ id: 1, level: 3 }, { id: 2, level: 2 }]
    const pools = hitDiceFromClasses(
      { dice: 'd10', diceCount: 5, diceUsed: 4 },
      entries,
      (entry) => entry.id === 1 ? 'd10' : 'd6',
    )
    expect(pools).toEqual([
      { die: 'd10', total: 3, used: 3 },
      { die: 'd6', total: 2, used: 1 },
    ])
  })
})
