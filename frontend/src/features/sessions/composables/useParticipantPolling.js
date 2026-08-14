import { onBeforeUnmount, ref } from 'vue'
import { pollChars } from '@/shared/api/sessionsApi'

const POLL_INTERVAL = 2000

export function useParticipantPolling({ participants }) {
  const pollStatus = ref('idle')
  const pollRunning = ref(false)
  const versions = ref({})
  let pollTimer = null

  function startPolling() {
    if (!participants.value.length) return
    versions.value = Object.fromEntries(participants.value.map(p => [p.charId, p.version ?? 0]))
    if (pollTimer == null && !pollRunning.value) schedulePoll()
  }

  function schedulePoll() {
    if (pollTimer != null) return
    pollTimer = setTimeout(doPoll, POLL_INTERVAL)
  }

  async function doPoll() {
    pollTimer = null
    if (!participants.value.length) { schedulePoll(); return }
    pollRunning.value = true
    const items = participants.value.map(p => ({ charId: p.charId, version: versions.value[p.charId] ?? 0 }))
    try {
      const results = await pollChars(items)
      const changed = results.filter(r => r.changed)
      if (changed.length) {
        changed.forEach(r => {
          const idx = participants.value.findIndex(p => p.charId === r.charId)
          if (idx !== -1) participants.value[idx] = { ...participants.value[idx], data: r.data }
          versions.value[r.charId] = r.version
        })
        pollStatus.value = 'changed'
        setTimeout(() => { pollStatus.value = 'idle' }, 600)
      } else {
        pollStatus.value = 'idle'
      }
    } catch {
      pollStatus.value = 'error'
      setTimeout(() => { pollStatus.value = 'idle' }, 1500)
    } finally {
      pollRunning.value = false
      schedulePoll()
    }
  }

  function forgetVersion(charId) {
    delete versions.value[charId]
  }

  onBeforeUnmount(() => {
    clearTimeout(pollTimer)
  })

  return {
    pollStatus,
    pollRunning,
    versions,
    startPolling,
    forgetVersion,
  }
}
