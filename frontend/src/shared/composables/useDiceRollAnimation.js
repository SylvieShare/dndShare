import { reactive } from 'vue'
import { evaluateDiceParts } from '@/shared/lib/dice'

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
  const pendingEntries = new Set()

  function rollKey(entryId, partIndex, rollIndex) {
    return `${entryId}:${partIndex}:${rollIndex}`
  }

  function displayedRoll(entry, partIndex, rollIndex, actual) {
    return displayedRolls.get(rollKey(entry.id, partIndex, rollIndex)) ?? actual ?? '…'
  }

  function randomSpinningFace(actual, sides, previous) {
    const candidates = []
    for (let value = 1; value <= sides; value += 1) {
      if (value !== actual && value !== previous) candidates.push(value)
    }
    if (!candidates.length) return actual
    return candidates[Math.floor(random() * candidates.length)]
  }

  function setDisplayedRolls(entry, step = 0) {
    const settled = step >= DICE_ROLL_ANIMATION_DELAYS.length
    const preFinal = step === DICE_ROLL_ANIMATION_DELAYS.length - 1
    entry.result.parts.forEach((part, partIndex) => {
      if (part.kind !== 'dice') return
      part.rolls.forEach((actual, rollIndex) => {
        const key = rollKey(entry.id, partIndex, rollIndex)
        const previous = displayedRolls.get(key)
        const minimum = Math.max(1, actual - 1)
        const maximum = Math.min(part.sides, actual + 1)
        const value = settled
          ? actual
          : preFinal
            ? minimum + Math.floor(random() * (maximum - minimum + 1))
            : randomSpinningFace(actual, part.sides, previous)
        displayedRolls.set(key, value)
      })
    })
  }

  function displayedTotal(entry) {
    if (!isTotalRolling(entry.id)) return entry.result.pending ? '…' : entry.result.total
    return evaluateDiceParts(entry.result.parts, (part, partIndex) => {
      let value = part.value
      if (part.kind === 'dice') {
        value = part.rolls.reduce((sum, actual, rollIndex) => {
          if (part.dropped?.includes(rollIndex)) return sum
          return sum + displayedRoll(entry, partIndex, rollIndex, actual)
        }, 0)
      }
      return value
    }).total
  }

  function clearEntryTimers(entryId) {
    const timers = animationTimers.get(entryId)
    if (timers) {
      for (const timer of timers) clearTimer(timer)
      animationTimers.delete(entryId)
    }
  }

  function clearEntryAnimation(entryId) {
    clearEntryTimers(entryId)
    pendingEntries.delete(entryId)
    rollingEntries.delete(entryId)
    rollingTotals.delete(entryId)
    for (const key of displayedRolls.keys()) {
      if (key.startsWith(`${entryId}:`)) displayedRolls.delete(key)
    }
  }

  function startEntryAnimation(entry) {
    const wasPending = pendingEntries.has(entry.id)
    if (wasPending) clearEntryTimers(entry.id)
    else clearEntryAnimation(entry.id)
    pendingEntries.delete(entry.id)
    if (!shouldAnimate?.()) { clearEntryAnimation(entry.id); return }

    rollingEntries.add(entry.id)
    rollingTotals.add(entry.id)
    if (!wasPending) setDisplayedRolls(entry)
    const timers = new Set()
    animationTimers.set(entry.id, timers)
    if (entry.result.pending) {
      pendingEntries.add(entry.id)
      function spin() {
        const timer = setTimer(() => {
          timers.delete(timer)
          setDisplayedRolls(entry)
          spin()
        }, DICE_ROLL_ANIMATION_DELAYS[0])
        timers.add(timer)
      }
      spin()
      return
    }
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
