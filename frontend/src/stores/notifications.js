import { defineStore } from 'pinia'
import { onScopeDispose, ref } from 'vue'

const DEFAULT_DURATION = 6000
const MAX_VISIBLE = 5

export const useNotificationsStore = defineStore('notifications', () => {
  const entries = ref([])
  const timers = new Map()
  const handlers = new Map()
  let sequence = 0

  function dismiss(id) {
    clearTimeout(timers.get(id)?.timer)
    timers.delete(id)
    handlers.delete(id)
    entries.value = entries.value.filter(entry => entry.id !== id)
  }

  function resume(id, reason = 'manual') {
    const clock = timers.get(id)
    if (!clock) return
    clock.holds.delete(reason)
    if (clock.holds.size || clock.timer != null) return
    clock.startedAt = Date.now()
    clock.timer = setTimeout(() => dismiss(id), clock.remaining)
    const entry = entries.value.find(entry => entry.id === id)
    if (entry) entry.paused = false
  }

  function pause(id, reason = 'manual') {
    const clock = timers.get(id)
    if (!clock) return
    clock.holds.add(reason)
    if (clock.timer == null) return
    clearTimeout(clock.timer)
    clock.timer = null
    clock.remaining = Math.max(0, clock.remaining - (Date.now() - clock.startedAt))
    const entry = entries.value.find(entry => entry.id === id)
    if (entry) entry.paused = true
  }

  function notify({ type, title = '', data = {}, key = null, scope = null, duration = DEFAULT_DURATION, actions = [], onAction }) {
    const previous = key && entries.value.find(entry => entry.key === key)
    if (previous) dismiss(previous.id)
    const id = ++sequence
    const lifetime = Math.max(1000, Number(duration) || DEFAULT_DURATION)
    entries.value.push({ id, type, title, data, key, scope, duration: lifetime, actions, paused: false })
    if (onAction) handlers.set(id, onAction)
    timers.set(id, { timer: null, startedAt: 0, remaining: lifetime, holds: new Set() })
    resume(id)
    while (entries.value.length > MAX_VISIBLE) dismiss(entries.value[0].id)
    return id
  }

  function runAction(id, key) { return handlers.get(id)?.(key) }
  function clear(scope) {
    for (const entry of [...entries.value]) if (scope == null || entry.scope === scope) dismiss(entry.id)
  }
  onScopeDispose(clear)
  return { entries, notify, dismiss, pause, resume, runAction, clear }
})
