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
  it('marks changing faces as rolling and settles quickly on the stored result', () => {
    const animation = useDiceRollAnimation({ shouldAnimate: () => true, random: () => 0 })

    animation.startEntryAnimation(entry)
    expect(animation.isRolling(entry.id)).toBe(true)
    expect(animation.displayedRoll(entry, 0, 0, 17)).toBe(1)

    vi.advanceTimersByTime(DICE_ROLL_ANIMATION_DELAYS.at(-1))
    expect(animation.isRolling(entry.id)).toBe(false)
    expect(animation.displayedRoll(entry, 0, 0, 17)).toBe(17)
    expect(DICE_ROLL_ANIMATION_DELAYS.at(-1)).toBeLessThan(700)
  })

  it('skips animation when motion should be reduced', () => {
    const animation = useDiceRollAnimation({ shouldAnimate: () => false })
    animation.startEntryAnimation(entry)

    expect(animation.isRolling(entry.id)).toBe(false)
    expect(animation.displayedRoll(entry, 0, 0, 17)).toBe(17)
  })
})
