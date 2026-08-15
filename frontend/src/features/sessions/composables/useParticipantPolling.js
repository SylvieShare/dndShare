import { onBeforeUnmount, onMounted, ref } from 'vue'
import { pollChars } from '@/shared/api/sessionsApi'

const POLL_INTERVAL = 2000
const MEMBERSHIP_POLL_INTERVAL = 10000

export function useParticipantPolling({ participants, refreshParticipants }) {
  const pollStatus = ref('idle')
  const pollRunning = ref(false)
  const versions = ref({})
  let pollTimer = null
  let statusTimer = null
  let stopped = false
  let lastMembershipPoll = 0

  function documentHidden() {
    return typeof document !== 'undefined' && document.visibilityState === 'hidden'
  }

  function setTemporaryStatus(status, duration) {
    clearTimeout(statusTimer)
    pollStatus.value = status
    statusTimer = setTimeout(() => { pollStatus.value = 'idle' }, duration)
  }

  function syncVersions() {
    const activeIds = new Set(participants.value.map(participant => String(participant.charId)))
    const next = Object.fromEntries(Object.entries(versions.value).filter(([charId]) => activeIds.has(String(charId))))
    for (const participant of participants.value) {
      if (next[participant.charId] == null) next[participant.charId] = participant.version ?? 0
    }
    versions.value = next
  }

  function startPolling() {
    stopped = false
    syncVersions()
    if (pollTimer == null && !pollRunning.value) schedulePoll()
  }

  function schedulePoll() {
    if (stopped || documentHidden() || pollTimer != null) return
    pollTimer = setTimeout(doPoll, POLL_INTERVAL)
  }

  async function doPoll() {
    pollTimer = null
    if (stopped || documentHidden()) return
    pollRunning.value = true
    try {
      if (refreshParticipants && Date.now() - lastMembershipPoll >= MEMBERSHIP_POLL_INTERVAL) {
        lastMembershipPoll = Date.now()
        await refreshParticipants()
        if (stopped) return
        syncVersions()
      }
      if (!participants.value.length) return
      const items = participants.value.map(p => ({ charId: p.charId, version: versions.value[p.charId] ?? 0 }))
      const results = await pollChars(items)
      if (stopped) return
      const changed = results.filter(r => r.changed)
      if (changed.length) {
        changed.forEach(r => {
          const idx = participants.value.findIndex(p => p.charId === r.charId)
          if (idx !== -1) participants.value[idx] = { ...participants.value[idx], data: r.data }
          versions.value[r.charId] = r.version
        })
        setTemporaryStatus('changed', 600)
      } else {
        pollStatus.value = 'idle'
      }
    } catch {
      if (!stopped) setTemporaryStatus('error', 1500)
    } finally {
      pollRunning.value = false
      schedulePoll()
    }
  }

  function forgetVersion(charId) {
    const next = { ...versions.value }
    delete next[charId]
    versions.value = next
  }

  function onVisibilityChange() {
    if (documentHidden()) {
      clearTimeout(pollTimer)
      pollTimer = null
      return
    }
    schedulePoll()
  }

  onMounted(() => document.addEventListener('visibilitychange', onVisibilityChange))
  onBeforeUnmount(() => {
    stopped = true
    clearTimeout(pollTimer)
    clearTimeout(statusTimer)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  })

  return {
    pollStatus,
    pollRunning,
    versions,
    startPolling,
    forgetVersion,
  }
}
