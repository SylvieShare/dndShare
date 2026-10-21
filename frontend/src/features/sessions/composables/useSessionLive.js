import { onBeforeUnmount, ref, unref } from 'vue'
import { subscribeSessionLive } from './sessionLiveConnection'

export function useSessionLive({
  sessionUuid,
  onUpdate,
  onCatchUp,
  getChronicleCursor,
}) {
  const status = ref('idle'),
    catchingUp = ref(false)
  let unsubscribe, catchUpPromise
  function runCatchUp() {
    if (catchUpPromise) return catchUpPromise
    catchingUp.value = true
    catchUpPromise = Promise.resolve()
      .then(() => onCatchUp?.())
      .finally(() => {
        catchingUp.value = false
        catchUpPromise = null
      })
    return catchUpPromise
  }
  function start() {
    if (unsubscribe) return
    if (typeof EventSource === 'undefined') {
      status.value = 'error'
      return
    }
    unsubscribe = subscribeSessionLive(unref(sessionUuid), {
      status: (value) => {
        status.value = value
      },
      update: (update) => onUpdate?.(update),
      catchUp: runCatchUp,
      cursor: getChronicleCursor,
    })
  }
  function stop() {
    unsubscribe?.()
    unsubscribe = null
    status.value = 'idle'
  }
  onBeforeUnmount(stop)
  return { status, catchingUp, start, stop, catchUp: runCatchUp }
}
