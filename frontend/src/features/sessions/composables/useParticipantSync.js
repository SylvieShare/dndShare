import { ref } from 'vue'

// REST snapshots are only needed for recovery while the shared stream is down.
export function useParticipantSync({ refreshParticipants }) {
  const syncStatus = ref('idle'),
    syncRunning = ref(false)
  let pending = false,
    draining,
    statusTimer
  function requestParticipants() {
    pending = true
    if (draining) return draining
    draining = (async () => {
      syncRunning.value = true
      try {
        while (pending) {
          pending = false
          await refreshParticipants()
        }
        syncStatus.value = 'changed'
      } catch {
        syncStatus.value = 'error'
      } finally {
        syncRunning.value = false
        draining = null
        clearTimeout(statusTimer)
        statusTimer = setTimeout(() => {
          syncStatus.value = 'idle'
        }, 1800)
      }
    })()
    return draining
  }
  return { syncStatus, syncRunning, requestParticipants }
}
