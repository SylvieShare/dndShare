import { onBeforeUnmount, ref } from 'vue'

const FALLBACK_INITIAL_MS = 2_000
const FALLBACK_MAX_MS = 30_000

export function useSessionLive({ sessionUuid, onUpdate, onCatchUp }) {
  const status = ref('idle')
  const catchingUp = ref(false)
  let source = null
  let catchUpPromise = null
  let catchUpPending = false
  let fallbackTimer = null
  let fallbackDelay = FALLBACK_INITIAL_MS

  function runCatchUp() {
    catchUpPending = true
    if (catchUpPromise) return catchUpPromise
    catchUpPromise = (async () => {
      catchingUp.value = true
      try {
        while (catchUpPending) {
          catchUpPending = false
          await onCatchUp?.()
        }
      } finally {
        catchingUp.value = false
        catchUpPromise = null
      }
    })()
    return catchUpPromise
  }

  function handleUpdate(event) {
    try {
      const update = JSON.parse(event.data)
      Promise.resolve(onUpdate?.(update)).catch(() => {})
    } catch { /* malformed invalidations are ignored; reconnect catch-up is authoritative */ }
  }

  function stopFallback() {
    if (fallbackTimer != null) globalThis.clearTimeout(fallbackTimer)
    fallbackTimer = null
    fallbackDelay = FALLBACK_INITIAL_MS
  }

  function scheduleFallback() {
    if (fallbackTimer != null || !source) return
    fallbackTimer = globalThis.setTimeout(async () => {
      fallbackTimer = null
      if (globalThis.document?.visibilityState !== 'hidden') await runCatchUp().catch(() => {})
      if (source && status.value !== 'connected') {
        fallbackDelay = Math.min(FALLBACK_MAX_MS, Math.round(fallbackDelay * 1.8))
        scheduleFallback()
      }
    }, fallbackDelay)
  }

  function start() {
    if (source) return
    if (typeof EventSource === 'undefined') {
      status.value = 'error'
      return
    }
    status.value = 'connecting'
    const uuid = encodeURIComponent(sessionUuid)
    source = new EventSource(`/api/sessions/${uuid}/live`)
    source.addEventListener('update', handleUpdate)
    source.onopen = () => {
      stopFallback()
      status.value = 'connected'
      runCatchUp().catch(() => {})
    }
    source.onerror = () => {
      status.value = 'error'
      scheduleFallback()
    }
  }

  function stop() {
    source?.removeEventListener('update', handleUpdate)
    source?.close()
    source = null
    stopFallback()
    status.value = 'idle'
  }

  onBeforeUnmount(stop)

  return { status, catchingUp, start, stop, catchUp: runCatchUp }
}
