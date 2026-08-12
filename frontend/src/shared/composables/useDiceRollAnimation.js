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
  const animationTimers = new Map()

  function rollKey(entryId, partIndex, rollIndex) {
    return `${entryId}:${partIndex}:${rollIndex}`
  }

  function displayedRoll(entry, partIndex, rollIndex, actual) {
    return displayedRolls.get(rollKey(entry.id, partIndex, rollIndex)) ?? actual
  }

  function setDisplayedRolls(entry, settle = false) {
    entry.result.parts.forEach((part, partIndex) => {
      if (part.kind !== 'dice') return
      part.rolls.forEach((actual, rollIndex) => {
        const value = settle ? actual : Math.floor(random() * part.sides) + 1
        displayedRolls.set(rollKey(entry.id, partIndex, rollIndex), value)
      })
    })
  }

  function clearEntryAnimation(entryId) {
    const timers = animationTimers.get(entryId)
    if (timers) {
      for (const timer of timers) clearTimer(timer)
      animationTimers.delete(entryId)
    }
    rollingEntries.delete(entryId)
    for (const key of displayedRolls.keys()) {
      if (key.startsWith(`${entryId}:`)) displayedRolls.delete(key)
    }
  }

  function startEntryAnimation(entry) {
    clearEntryAnimation(entry.id)
    if (!shouldAnimate?.()) return

    rollingEntries.add(entry.id)
    setDisplayedRolls(entry)
    const timers = new Set()
    animationTimers.set(entry.id, timers)
    DICE_ROLL_ANIMATION_DELAYS.forEach((delay, index) => {
      const timer = setTimer(() => {
        timers.delete(timer)
        const settled = index === DICE_ROLL_ANIMATION_DELAYS.length - 1
        setDisplayedRolls(entry, settled)
        if (settled) rollingEntries.delete(entry.id)
        if (!timers.size) animationTimers.delete(entry.id)
      }, delay)
      timers.add(timer)
    })
  }

  function isRolling(entryId) {
    return rollingEntries.has(entryId)
  }

  function dispose() {
    for (const entryId of [...animationTimers.keys()]) clearEntryAnimation(entryId)
  }

  return { displayedRoll, startEntryAnimation, clearEntryAnimation, isRolling, dispose }
}
