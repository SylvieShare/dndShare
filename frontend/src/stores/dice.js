import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useNotificationsStore } from '@/stores/notifications'
import { evaluateDiceParts, rollDiceExpression } from '@/shared/lib/dice'
import { useSessionEventsStore } from '@/stores/sessionEvents'

function detectOutcome(result, criticalThreshold = null) {
  let fumble = null
  for (const p of result.parts) {
    if (p.kind !== 'dice') continue
    const rolls = p.keptIndex == null ? p.rolls : [p.rolls[p.keptIndex]]
    for (const r of rolls) {
      const threshold = p.sides === 20 && criticalThreshold != null ? Math.max(2, Number(criticalThreshold) || 20) : p.sides
      if (r >= threshold) return { kind: 'crit', sides: p.sides, value: r }
      if (r === 1 && !fumble) fumble = { kind: 'fumble', sides: p.sides, value: r }
    }
  }
  return fumble
}

function keptNaturalD20(result) {
  const part = result.parts.find((row) => row.kind === 'dice' && row.sides === 20)
  if (!part) return null
  return part.keptIndex == null ? part.rolls?.[0] : part.rolls?.[part.keptIndex]
}

function applyD20Adjustments(result, adjustments = []) {
  const part = result.parts.find((row) => row.kind === 'dice' && row.sides === 20)
  if (!part) return []
  const keptIndex = part.keptIndex == null ? 0 : part.keptIndex
  const natural = Number(part.rolls?.[keptIndex]) || 0
  const rule = adjustments
    .filter(row => row?.kind === 'minimum_natural')
    .map(row => ({ ...row, value: Math.max(0, Number(row.value) || 0) }))
    .filter(row => row.value > natural)
    .sort((left, right) => right.value - left.value)[0]
  if (!rule) return []

  part.sum = rule.value
  result.total = evaluateDiceParts(result.parts).total
  result.byType = [{ label: null, color: null, value: result.total }]
  const applied = [{
    kind: rule.kind,
    label: rule.label || rule.source_label || 'Корректировка броска',
    original: natural,
    value: rule.value,
  }]
  result.adjustments = applied
  return applied
}

export const useDiceStore = defineStore('dice', () => {
  const notifications = useNotificationsStore()
  const stack = computed(() => notifications.entries.filter(entry => entry.type === 'dice').map(entry => ({ ...entry.data, id: entry.id, title: entry.title })))
  const lastD20 = ref(null)
  const dismiss = id => notifications.dismiss(id)

  function pushEntry(entry) {
    const duration = entry.duration || 6000
    useSessionEventsStore().markLocalRoll(entry.result)
    const action = entry.action || 'Бросок'
    const actorName = String(entry.actor?.name || '').trim()
    if (entry.result?.parts?.some(part => part.kind === 'dice' && part.sides === 20)) lastD20.value = null
    if (entry.popup !== false) {
      const popupEntry = {
        title: actorName ? `${actorName} — ${action}` : action,
        result: entry.result,
        outcome: entry.outcome || null,
        color: entry.color || null,
        duration,
        actions: Array.isArray(entry.actions) ? entry.actions : [],
        rerollSpec: entry.rerollSpec || null,
      }
      const id = notifications.notify({ type: 'dice', title: popupEntry.title, data: popupEntry, duration,
        scope: 'dice', onAction: key => runAction(id, key) })
      popupEntry.id = id
      if (entry.result?.parts?.some(part => part.kind === 'dice' && part.sides === 20)) lastD20.value = popupEntry
    }
    if (entry.log !== false) {
      useSessionEventsStore().publish({
        type: 'dice_roll',
        notify: false,
        action,
        actor: entry.actor,
        data: {
          ...entry.eventData,
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
    const outcome = opts.crit_mode ? detectOutcome(result, opts.critical_threshold) : null
    return pushEntry({
      action,
      actor: opts.actor,
      eventData: opts.eventData,
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
    const expression = `${normalizedMode === 'normal' ? 1 : 2}d20${modifier >= 0 ? '+' : ''}${modifier}${opts.bonus_formula ? ` + ${opts.bonus_formula}` : ''}`
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
    const appliedAdjustments = applyD20Adjustments(result, Array.isArray(opts.roll_adjustments) ? opts.roll_adjustments : [])
    const detectedOutcome = opts.crit_mode ? detectOutcome(result, opts.critical_threshold) : null
    const outcome = appliedAdjustments.length && detectedOutcome?.kind === 'fumble' ? null : detectedOutcome
    const triggers = (Array.isArray(opts.roll_triggers) ? opts.roll_triggers : [])
      .filter(rule => rule.action === 'reroll' && (rule.event === 'any' || (rule.event === 'natural_one' && keptNaturalD20(result) === 1)))
    const actions = triggers.map((rule, index) => ({
      key: index === 0 ? 'reroll' : `reroll:${index}`,
      label: rule.label || `Перебросить — ${rule.source_label || 'способность'}`,
      useRef: rule.useRef, consume: rule.consume,
    }))
    return pushEntry({
      action, actor: opts.actor, eventData: opts.eventData, result, outcome, color: opts.color,
      popup: opts.popup, log: opts.log, duration: opts.duration,
      actions,
      rerollSpec: actions.length ? { action, bonus, mode: normalizedMode, opts: { ...opts, roll_triggers: [] } } : null,
    })
  }

  function runAction(id, key) {
    const entry = notifications.entries.find(row => row.id === id && row.type === 'dice')?.data || (lastD20.value?.id === id ? lastD20.value : null)
    const selected = entry?.actions?.find(action => action.key === key)
    if (!selected || !entry.rerollSpec) return null
    if (selected.consume && !selected.consume()) { entry.actions = entry.actions.filter(action => action.key !== key); return null }
    entry.actions = []
    const spec = entry.rerollSpec
    dismiss(id)
    const result = rollD20(spec.action, spec.bonus, spec.mode, spec.opts)
    spec.opts.onReroll?.(result)
    return result
  }

  function clear() {
    notifications.clear('dice')
    lastD20.value = null
  }

  return { stack, lastD20, roll, rollD20, pushEntry, runAction, dismiss, clear }
})
