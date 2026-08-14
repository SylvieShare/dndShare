import { defineStore } from 'pinia'
import { ref } from 'vue'
import { rollDiceExpression } from '@/shared/lib/dice'
import { useSessionEventsStore } from '@/stores/sessionEvents'

const AUTO_DISMISS_MS = 6000
const MAX_STACK = 5

function detectOutcome(result) {
  let fumble = null
  for (const p of result.parts) {
    if (p.kind !== 'dice') continue
    for (const r of p.rolls) {
      if (r === p.sides) return { kind: 'crit', sides: p.sides, value: r }
      if (r === 1 && !fumble) fumble = { kind: 'fumble', sides: p.sides, value: r }
    }
  }
  return fumble
}

export const useDiceStore = defineStore('dice', () => {
  const stack = ref([])
  const timers = new Map()
  let seq = 0

  function dismiss(id) {
    stack.value = stack.value.filter(e => e.id !== id)
    const t = timers.get(id)
    if (t) {
      clearTimeout(t)
      timers.delete(id)
    }
  }

  function scheduleDismiss(id, ms) {
    const t = setTimeout(() => {
      stack.value = stack.value.filter(e => e.id !== id)
      timers.delete(id)
    }, ms)
    timers.set(id, t)
  }

  function pushEntry(entry) {
    seq += 1
    const id = seq
    const duration = entry.duration || AUTO_DISMISS_MS
    stack.value.push({
      id,
      title: entry.title || '',
      result: entry.result,
      outcome: entry.outcome || null,
      color: entry.color || null,
      duration,
    })
    while (stack.value.length > MAX_STACK) {
      const removed = stack.value.shift()
      const t = timers.get(removed.id)
      if (t) { clearTimeout(t); timers.delete(removed.id) }
    }
    scheduleDismiss(id, duration)
    if (entry.log !== false) {
      useSessionEventsStore().publish({
        type: 'dice_roll',
        title: entry.title || 'Бросок',
        data: {
          result: entry.result,
          outcome: entry.outcome || null,
          color: entry.color || null,
        },
      })
    }
    return entry.result
  }

  function roll(title, expression, opts = {}) {
    const result = rollDiceExpression(expression)
    const outcome = opts.crit_mode ? detectOutcome(result) : null
    return pushEntry({ title, result, outcome, color: opts.color })
  }

  function clear() {
    for (const t of timers.values()) clearTimeout(t)
    timers.clear()
    stack.value = []
  }

  return { stack, roll, pushEntry, dismiss, clear }
})
