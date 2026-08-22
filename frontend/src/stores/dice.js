import { defineStore } from 'pinia'
import { ref } from 'vue'
import { evaluateDiceParts, rollDiceExpression } from '@/shared/lib/dice'
import { useSessionEventsStore } from '@/stores/sessionEvents'

const AUTO_DISMISS_MS = 6000
const MAX_STACK = 5

function detectOutcome(result) {
  let fumble = null
  for (const p of result.parts) {
    if (p.kind !== 'dice') continue
    const rolls = p.keptIndex == null ? p.rolls : [p.rolls[p.keptIndex]]
    for (const r of rolls) {
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
    const duration = entry.duration || AUTO_DISMISS_MS
    const action = entry.action || 'Бросок'
    const actorName = String(entry.actor?.name || '').trim()
    if (entry.popup !== false) {
      seq += 1
      const id = seq
      stack.value.push({
        id,
        title: actorName ? `${actorName} — ${action}` : action,
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
    }
    if (entry.log !== false) {
      useSessionEventsStore().publish({
        type: 'dice_roll',
        action,
        actor: entry.actor,
        data: {
          result: entry.result,
          outcome: entry.outcome || null,
          color: entry.color || null,
        },
      })
    }
    return entry.result
  }

  function roll(action, expression, opts = {}) {
    const result = rollDiceExpression(expression)
    const outcome = opts.crit_mode ? detectOutcome(result) : null
    return pushEntry({
      action,
      actor: opts.actor,
      result,
      outcome,
      color: opts.color,
      popup: opts.popup,
      log: opts.log,
      duration: opts.duration,
    })
  }

  function rollD20(action, bonus = 0, mode = 'normal', opts = {}) {
    const normalizedMode = ['advantage', 'disadvantage'].includes(mode) ? mode : 'normal'
    const modifier = Number(bonus) || 0
    const expression = `${normalizedMode === 'normal' ? 1 : 2}d20${modifier >= 0 ? '+' : ''}${modifier}`
    const result = rollDiceExpression(expression)
    if (normalizedMode !== 'normal') {
      const part = result.parts.find(row => row.kind === 'dice' && row.sides === 20)
      if (part?.rolls?.length >= 2) {
        const target = normalizedMode === 'advantage' ? Math.max(...part.rolls) : Math.min(...part.rolls)
        part.keptIndex = part.rolls.indexOf(target)
        part.dropped = part.rolls.map((_, index) => index).filter(index => index !== part.keptIndex)
        part.sum = target
        result.total = evaluateDiceParts(result.parts).total
        result.byType = [{ label: null, color: null, value: result.total }]
      }
    }
    result.rollMode = normalizedMode
    const outcome = opts.crit_mode ? detectOutcome(result) : null
    return pushEntry({
      action, actor: opts.actor, result, outcome, color: opts.color,
      popup: opts.popup, log: opts.log, duration: opts.duration,
    })
  }

  function clear() {
    for (const t of timers.values()) clearTimeout(t)
    timers.clear()
    stack.value = []
  }

  return { stack, roll, rollD20, pushEntry, dismiss, clear }
})
