import { computed, ref } from 'vue'
import {
  createSessionTimer,
  deleteSessionTimer,
  getSessionTimers,
  subtractSessionTimerTime,
  updateSessionTimer,
} from '@/shared/api/sessionsApi'
import { timerProgress, timerRemainingMs } from '@/features/sessions/lib/sessionTimers'

export function useSessionTimers({ sessionUuid }) {
  const timers = ref([])
  const clock = ref(Date.now())
  const serverOffsetMs = ref(0)
  const loading = ref(false)
  const creating = ref(false)
  const pendingIds = ref(new Set())
  const error = ref('')
  let ticker = null

  const serverNow = computed(() => clock.value - serverOffsetMs.value)
  const displayed = computed(() => timers.value.map(timer => {
    const remainingMs = timerRemainingMs(timer, serverNow.value)
    return {
      ...timer,
      remainingMs,
      progress: timerProgress(timer, serverNow.value),
      completed: remainingMs <= 0,
    }
  }))
  const completedCount = computed(() => displayed.value.filter(timer => timer.completed).length)

  function startClock() {
    if (ticker != null) return
    ticker = window.setInterval(() => { clock.value = Date.now() }, 250)
  }

  function syncClock(serverTime, requestedAt = Date.now()) {
    const receivedAt = Date.now()
    const remote = Number(serverTime)
    if (Number.isFinite(remote)) serverOffsetMs.value = ((requestedAt + receivedAt) / 2) - remote
    clock.value = receivedAt
    startClock()
  }

  function replaceTimer(timer) {
    const index = timers.value.findIndex(item => item.id === timer.id)
    timers.value = index < 0
      ? [...timers.value, timer]
      : timers.value.map(item => item.id === timer.id ? timer : item)
  }

  async function load() {
    if (loading.value) return
    loading.value = true
    error.value = ''
    const requestedAt = Date.now()
    try {
      const response = await getSessionTimers(sessionUuid)
      timers.value = Array.isArray(response?.timers) ? response.timers : []
      syncClock(response?.serverTime, requestedAt)
    } catch (reason) {
      error.value = reason?.message || 'Не удалось загрузить таймеры'
      throw reason
    } finally {
      loading.value = false
    }
  }

  async function create({ description, durationMs }) {
    if (creating.value) return null
    creating.value = true
    error.value = ''
    const requestedAt = Date.now()
    try {
      const response = await createSessionTimer(sessionUuid, { description, durationMs })
      replaceTimer(response.timer)
      syncClock(response.serverTime, requestedAt)
      return response.timer
    } catch (reason) {
      error.value = reason?.message || 'Не удалось запустить таймер'
      throw reason
    } finally {
      creating.value = false
    }
  }

  async function mutate(timerId, payload) {
    if (pendingIds.value.has(timerId)) return null
    pendingIds.value = new Set([...pendingIds.value, timerId])
    error.value = ''
    const requestedAt = Date.now()
    try {
      const response = await updateSessionTimer(sessionUuid, timerId, payload)
      replaceTimer(response.timer)
      syncClock(response.serverTime, requestedAt)
      return response.timer
    } catch (reason) {
      error.value = reason?.message || 'Не удалось обновить таймер'
      throw reason
    } finally {
      const next = new Set(pendingIds.value)
      next.delete(timerId)
      pendingIds.value = next
    }
  }

  const pause = timerId => mutate(timerId, { action: 'pause' })
  const resume = timerId => mutate(timerId, { action: 'resume' })
  const addTime = (timerId, amountMs) => mutate(timerId, { action: 'add', amountMs })

  async function subtractTime(timerId, amountMs) {
    if (pendingIds.value.has(timerId)) return null
    pendingIds.value = new Set([...pendingIds.value, timerId])
    error.value = ''
    const requestedAt = Date.now()
    try {
      const response = await subtractSessionTimerTime(sessionUuid, timerId, amountMs)
      replaceTimer(response.timer)
      syncClock(response.serverTime, requestedAt)
      return response.timer
    } catch (reason) {
      error.value = reason?.message || 'Не удалось уменьшить таймер'
      throw reason
    } finally {
      const next = new Set(pendingIds.value)
      next.delete(timerId)
      pendingIds.value = next
    }
  }

  async function remove(timerId) {
    if (pendingIds.value.has(timerId)) return
    pendingIds.value = new Set([...pendingIds.value, timerId])
    error.value = ''
    try {
      await deleteSessionTimer(sessionUuid, timerId)
      timers.value = timers.value.filter(timer => timer.id !== timerId)
    } catch (reason) {
      error.value = reason?.message || 'Не удалось убрать таймер'
      throw reason
    } finally {
      const next = new Set(pendingIds.value)
      next.delete(timerId)
      pendingIds.value = next
    }
  }

  function isPending(timerId) {
    return pendingIds.value.has(timerId)
  }

  function dispose() {
    if (ticker != null) window.clearInterval(ticker)
    ticker = null
  }

  return {
    timers, displayed, completedCount, loading, creating, pendingIds, error,
    load, create, pause, resume, addTime, subtractTime, remove, isPending, dispose,
  }
}
