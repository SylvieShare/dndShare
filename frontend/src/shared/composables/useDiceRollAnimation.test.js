import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DICE_ROLL_ANIMATION_DELAYS,
  useDiceRollAnimation,
} from './useDiceRollAnimation'

const entry = {
  id: 7,
  result: { parts: [{ kind: 'dice', sides: 20, rolls: [17] }] },
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('dice roll presentation animation', () => {
  it('narrows changing faces toward the stored result and settles quickly', () => {
    const animation = useDiceRollAnimation({ shouldAnimate: () => true, random: () => 0 })

    animation.startEntryAnimation(entry)
    expect(animation.isRolling(entry.id)).toBe(true)
    const distances = [Math.abs(animation.displayedRoll(entry, 0, 0, 17) - 17)]

    let elapsed = 0
    for (const delay of DICE_ROLL_ANIMATION_DELAYS) {
      vi.advanceTimersByTime(delay - elapsed)
      elapsed = delay
      distances.push(Math.abs(animation.displayedRoll(entry, 0, 0, 17) - 17))
    }

    expect(animation.isRolling(entry.id)).toBe(false)
    expect(animation.displayedRoll(entry, 0, 0, 17)).toBe(17)
    expect(distances[0]).toBeGreaterThan(0)
    expect(distances.at(-1)).toBe(0)
    distances.slice(1).forEach((distance, index) => {
      expect(distance).toBeLessThanOrEqual(distances[index])
    })
    expect(DICE_ROLL_ANIMATION_DELAYS.at(-1)).toBeLessThan(700)
  })

  it('jumps the displayed total with the visible kept dice before settling', () => {
    const resultEntry = {
      id: 8,
      result: {
        parts: [
          { sign: '+', kind: 'dice', sides: 20, rolls: [17] },
          { sign: '+', kind: 'flat', value: 3 },
          { sign: '-', kind: 'dice', sides: 6, rolls: [2, 5], dropped: [0] },
        ],
        total: 15,
      },
    }
    const animation = useDiceRollAnimation({ shouldAnimate: () => true, random: () => 0 })

    animation.startEntryAnimation(resultEntry)
    const shownD20 = animation.displayedRoll(resultEntry, 0, 0, 17)
    const shownKeptD6 = animation.displayedRoll(resultEntry, 2, 1, 5)
    expect(animation.displayedTotal(resultEntry)).toBe(shownD20 + 3 - shownKeptD6)

    vi.advanceTimersByTime(DICE_ROLL_ANIMATION_DELAYS.at(-1))
    expect(animation.displayedTotal(resultEntry)).toBe(15)
  })

  it('skips animation when motion should be reduced', () => {
    const animation = useDiceRollAnimation({ shouldAnimate: () => false })
    animation.startEntryAnimation(entry)

    expect(animation.isRolling(entry.id)).toBe(false)
    expect(animation.displayedRoll(entry, 0, 0, 17)).toBe(17)
    expect(animation.displayedTotal({ ...entry, result: { ...entry.result, total: 17 } })).toBe(17)
  })
})
