import { reactive } from 'vue'

export const DICE_ROLL_ANIMATION_DELAYS = [40, 85, 145, 220, 310, 420, 560]

export function useDiceRollAnimation({
  shouldAnimate,
  random = Math.random,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  const displayedRolls = reactive(new Map())
  const rollingEntries = reactive(new Set())
  const rollingTotals = reactive(new Set())
  const animationTimers = new Map()

  function rollKey(entryId, partIndex, rollIndex) {
    return `${entryId}:${partIndex}:${rollIndex}`
  }

  function displayedRoll(entry, partIndex, rollIndex, actual) {
    return displayedRolls.get(rollKey(entry.id, partIndex, rollIndex)) ?? actual
  }

  function randomNearbyFace(actual, sides, maxDistance, minDistance = 1) {
    const candidates = []
    for (let value = 1; value <= sides; value += 1) {
      const distance = Math.abs(value - actual)
      if (distance >= minDistance && distance <= maxDistance) candidates.push(value)
    }
    if (!candidates.length) return actual
    return candidates[Math.floor(random() * candidates.length)]
  }

  function nextDisplayedFace(actual, sides, previous, progress) {
    const scheduledDistance = Math.max(1, Math.ceil((sides - 1) * ((1 - progress) ** 1.4)))
    const previousDistance = Math.abs(previous - actual)
    const maxDistance = Math.min(
      scheduledDistance,
      previousDistance > 1 ? previousDistance - 1 : 1,
    )
    const minDistance = Math.max(1, Math.ceil(maxDistance * 0.45))
    return randomNearbyFace(actual, sides, maxDistance, minDistance)
  }

  function setDisplayedRolls(entry, step = 0) {
    const settled = step >= DICE_ROLL_ANIMATION_DELAYS.length
    const progress = step / DICE_ROLL_ANIMATION_DELAYS.length
    entry.result.parts.forEach((part, partIndex) => {
      if (part.kind !== 'dice') return
      part.rolls.forEach((actual, rollIndex) => {
        const key = rollKey(entry.id, partIndex, rollIndex)
        const previous = displayedRolls.get(key)
        const value = settled
          ? actual
          : previous == null
            ? randomNearbyFace(
                actual,
                part.sides,
                part.sides - 1,
                Math.max(1, Math.ceil((part.sides - 1) * 0.35)),
              )
            : nextDisplayedFace(actual, part.sides, previous, progress)
        displayedRolls.set(key, value)
      })
    })
  }

  function displayedTotal(entry) {
    if (!isTotalRolling(entry.id)) return entry.result.total
    return entry.result.parts.reduce((total, part, partIndex) => {
      let value = part.value
      if (part.kind === 'dice') {
        value = part.rolls.reduce((sum, actual, rollIndex) => {
          if (part.dropped?.includes(rollIndex)) return sum
          return sum + displayedRoll(entry, partIndex, rollIndex, actual)
        }, 0)
      }
      return total + (part.sign === '-' ? -value : value)
    }, 0)
  }

  function clearEntryAnimation(entryId) {
    const timers = animationTimers.get(entryId)
    if (timers) {
      for (const timer of timers) clearTimer(timer)
      animationTimers.delete(entryId)
    }
    rollingEntries.delete(entryId)
    rollingTotals.delete(entryId)
    for (const key of displayedRolls.keys()) {
      if (key.startsWith(`${entryId}:`)) displayedRolls.delete(key)
    }
  }

  function startEntryAnimation(entry) {
    clearEntryAnimation(entry.id)
    if (!shouldAnimate?.()) return

    rollingEntries.add(entry.id)
    rollingTotals.add(entry.id)
    setDisplayedRolls(entry)
    const timers = new Set()
    animationTimers.set(entry.id, timers)
    DICE_ROLL_ANIMATION_DELAYS.forEach((delay, index) => {
      const timer = setTimer(() => {
        timers.delete(timer)
        const settled = index === DICE_ROLL_ANIMATION_DELAYS.length - 1
        const totalSettled = index === DICE_ROLL_ANIMATION_DELAYS.length - 3
        setDisplayedRolls(entry, index + 1)
        if (totalSettled) rollingTotals.delete(entry.id)
        if (settled) rollingEntries.delete(entry.id)
        if (!timers.size) animationTimers.delete(entry.id)
      }, delay)
      timers.add(timer)
    })
  }

  function isRolling(entryId) {
    return rollingEntries.has(entryId)
  }

  function isTotalRolling(entryId) {
    return rollingTotals.has(entryId)
  }

  function dispose() {
    for (const entryId of [...animationTimers.keys()]) clearEntryAnimation(entryId)
  }

  return {
    displayedRoll,
    displayedTotal,
    startEntryAnimation,
    clearEntryAnimation,
    isRolling,
    isTotalRolling,
    dispose,
  }
}
