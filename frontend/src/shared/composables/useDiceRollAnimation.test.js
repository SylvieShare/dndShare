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
  it('keeps every temporary face moving before it settles quickly', () => {
    const animation = useDiceRollAnimation({ shouldAnimate: () => true, random: () => 0.999 })

    animation.startEntryAnimation(entry)
    expect(animation.isRolling(entry.id)).toBe(true)
    const shownFaces = [animation.displayedRoll(entry, 0, 0, 17)]

    let elapsed = 0
    for (const delay of DICE_ROLL_ANIMATION_DELAYS) {
      vi.advanceTimersByTime(delay - elapsed)
      elapsed = delay
      shownFaces.push(animation.displayedRoll(entry, 0, 0, 17))
    }

    expect(animation.isRolling(entry.id)).toBe(false)
    expect(animation.displayedRoll(entry, 0, 0, 17)).toBe(17)
    shownFaces.slice(0, -2).forEach((face, index) => {
      expect(face).not.toBe(17)
      if (index > 0) expect(face).not.toBe(shownFaces[index - 1])
    })
    expect(DICE_ROLL_ANIMATION_DELAYS.at(-1)).toBeLessThan(700)
  })

  it.each([
    ['a low-sided die', 4],
    ['a low result', 20],
  ])('does not stall for %s', (_, sides) => {
    const lowEntry = {
      id: sides,
      result: { parts: [{ kind: 'dice', sides, rolls: [1] }] },
    }
    const animation = useDiceRollAnimation({ shouldAnimate: () => true, random: () => 0.999 })

    animation.startEntryAnimation(lowEntry)
    const shownFaces = [animation.displayedRoll(lowEntry, 0, 0, 1)]
    let elapsed = 0
    for (const delay of DICE_ROLL_ANIMATION_DELAYS.slice(0, -2)) {
      vi.advanceTimersByTime(delay - elapsed)
      elapsed = delay
      shownFaces.push(animation.displayedRoll(lowEntry, 0, 0, 1))
    }

    expect(shownFaces).not.toContain(1)
    shownFaces.slice(1).forEach((face, index) => {
      expect(face).not.toBe(shownFaces[index])
    })

    vi.advanceTimersByTime(DICE_ROLL_ANIMATION_DELAYS.at(-1) - elapsed)
    expect(animation.displayedRoll(lowEntry, 0, 0, 1)).toBe(1)
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
    expect(animation.isTotalRolling(resultEntry.id)).toBe(true)
    const shownD20 = animation.displayedRoll(resultEntry, 0, 0, 17)
    const shownKeptD6 = animation.displayedRoll(resultEntry, 2, 1, 5)
    expect(animation.displayedTotal(resultEntry)).toBe(shownD20 + 3 - shownKeptD6)

    vi.advanceTimersByTime(DICE_ROLL_ANIMATION_DELAYS.at(-3))
    expect(animation.isRolling(resultEntry.id)).toBe(true)
    expect(animation.isTotalRolling(resultEntry.id)).toBe(false)
    expect(animation.displayedTotal(resultEntry)).toBe(15)
    expect(animation.displayedRoll(resultEntry, 0, 0, 17)).not.toBe(17)

    vi.advanceTimersByTime(DICE_ROLL_ANIMATION_DELAYS.at(-1) - DICE_ROLL_ANIMATION_DELAYS.at(-3))
    expect(animation.isRolling(resultEntry.id)).toBe(false)
  })

  it('can show the stored face on the pre-final tick without ending the animation', () => {
    const animation = useDiceRollAnimation({ shouldAnimate: () => true, random: () => 0.5 })

    animation.startEntryAnimation(entry)
    vi.advanceTimersByTime(DICE_ROLL_ANIMATION_DELAYS.at(-2))

    expect(animation.isRolling(entry.id)).toBe(true)
    expect(animation.displayedRoll(entry, 0, 0, 17)).toBe(17)

    vi.advanceTimersByTime(DICE_ROLL_ANIMATION_DELAYS.at(-1) - DICE_ROLL_ANIMATION_DELAYS.at(-2))
    expect(animation.isRolling(entry.id)).toBe(false)
    expect(animation.displayedRoll(entry, 0, 0, 17)).toBe(17)
  })

  it('can keep a nearby face until the final tick', () => {
    const animation = useDiceRollAnimation({ shouldAnimate: () => true, random: () => 0.999 })

    animation.startEntryAnimation(entry)
    vi.advanceTimersByTime(DICE_ROLL_ANIMATION_DELAYS.at(-2))

    expect(animation.displayedRoll(entry, 0, 0, 17)).toBe(18)

    vi.advanceTimersByTime(DICE_ROLL_ANIMATION_DELAYS.at(-1) - DICE_ROLL_ANIMATION_DELAYS.at(-2))
    expect(animation.displayedRoll(entry, 0, 0, 17)).toBe(17)
  })

  it.each([
    [20, 17, [16, 17, 18]],
    [20, 1, [1, 2]],
    [20, 20, [19, 20]],
    [4, 2, [1, 2, 3]],
    [100, 100, [99, 100]],
    [2, 1, [1, 2]],
    [1, 1, [1]],
  ])('uniformly picks only the result and valid neighbours for d%i result %i', (sides, actual, expected) => {
    const sampleEntry = {
      id: 9,
      result: { parts: [{ kind: 'dice', sides, rolls: [actual, actual] }] },
    }
    const counts = new Map()
    let sample = 0
    const animation = useDiceRollAnimation({ shouldAnimate: () => true, random: () => sample })

    for (let index = 0; index < 60; index += 1) {
      sample = index / 60
      animation.startEntryAnimation(sampleEntry)
      vi.advanceTimersByTime(DICE_ROLL_ANIMATION_DELAYS.at(-2))
      const face = animation.displayedRoll(sampleEntry, 0, 0, actual)
      counts.set(face, (counts.get(face) || 0) + 1)
      expect(animation.displayedRoll(sampleEntry, 0, 1, actual)).toBe(face)
      expect(animation.isRolling(sampleEntry.id)).toBe(true)

      vi.advanceTimersByTime(DICE_ROLL_ANIMATION_DELAYS.at(-1) - DICE_ROLL_ANIMATION_DELAYS.at(-2))
      expect(animation.displayedRoll(sampleEntry, 0, 0, actual)).toBe(actual)
      expect(sampleEntry.result.parts[0].rolls).toEqual([actual, actual])
    }

    expect([...counts.keys()]).toEqual(expected)
    expect([...counts.values()]).toEqual(expected.map(() => 60 / expected.length))
  })

  it('skips animation when motion should be reduced', () => {
    const animation = useDiceRollAnimation({ shouldAnimate: () => false })
    animation.startEntryAnimation(entry)

    expect(animation.isRolling(entry.id)).toBe(false)
    expect(animation.isTotalRolling(entry.id)).toBe(false)
    expect(animation.displayedRoll(entry, 0, 0, 17)).toBe(17)
    expect(animation.displayedTotal({ ...entry, result: { ...entry.result, total: 17 } })).toBe(17)
  })
})
