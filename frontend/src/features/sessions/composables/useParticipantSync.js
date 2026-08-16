import { ref } from 'vue'
import { pollChars } from '@/shared/api/sessionsApi'

// Serializes participant snapshot and character-version refreshes. Live SSE
// invalidations may arrive in bursts; one drain loop folds them into the
// smallest useful set of REST reads.
export function useParticipantSync({ participants, refreshParticipants }) {
  const syncStatus = ref('idle')
  const syncRunning = ref(false)
  const versions = ref({})
  let membershipPending = false
  let pendingCharacterIds = new Set()
  let drainPromise = null
  let statusTimer = null

  function setTemporaryStatus(status, duration) {
    clearTimeout(statusTimer)
    syncStatus.value = status
    statusTimer = setTimeout(() => { syncStatus.value = 'idle' }, duration)
  }

  function syncVersions() {
    const activeIds = new Set(participants.value.map(participant => String(participant.charId)))
    const next = Object.fromEntries(Object.entries(versions.value).filter(([charId]) => activeIds.has(String(charId))))
    for (const participant of participants.value) {
      if (participant.version != null) next[participant.charId] = participant.version
      else if (next[participant.charId] == null) next[participant.charId] = 0
    }
    versions.value = next
  }

  async function refreshCharacters(characterIds) {
    syncVersions()
    const requested = characterIds ? new Set(characterIds.map(String)) : null
    const selected = participants.value.filter(participant => !requested || requested.has(String(participant.charId)))
    if (!selected.length) return false
    const items = selected.map(participant => ({
      charId: participant.charId,
      version: versions.value[participant.charId] ?? 0,
    }))
    const results = await pollChars(items)
    let changed = false
    for (const result of results) {
      if (!result.changed) continue
      const index = participants.value.findIndex(participant => participant.charId === result.charId)
      if (index !== -1) {
        participants.value[index] = {
          ...participants.value[index],
          data: result.data,
          version: result.version,
        }
        changed = true
      }
      versions.value[result.charId] = result.version
    }
    return changed
  }

  function ensureDrain() {
    if (drainPromise) return drainPromise
    drainPromise = (async () => {
      syncRunning.value = true
      let changed = false
      try {
        while (membershipPending || pendingCharacterIds.size) {
          const refreshMembership = membershipPending
          const characterIds = [...pendingCharacterIds]
          membershipPending = false
          pendingCharacterIds = new Set()
          if (refreshMembership) {
            await refreshParticipants()
            syncVersions()
            changed = true
          } else {
            changed = await refreshCharacters(characterIds) || changed
          }
        }
        if (changed) setTemporaryStatus('changed', 600)
        else syncStatus.value = 'idle'
      } catch {
        setTemporaryStatus('error', 1800)
      } finally {
        syncRunning.value = false
        drainPromise = null
        if (membershipPending || pendingCharacterIds.size) ensureDrain()
      }
    })()
    return drainPromise
  }

  function requestParticipants() {
    membershipPending = true
    return ensureDrain()
  }

  function requestCharacters(characterIds = []) {
    for (const characterId of characterIds) pendingCharacterIds.add(characterId)
    return ensureDrain()
  }

  function forgetVersion(characterId) {
    const next = { ...versions.value }
    delete next[characterId]
    versions.value = next
  }

  syncVersions()

  return {
    syncStatus,
    syncRunning,
    versions,
    syncVersions,
    requestParticipants,
    requestCharacters,
    forgetVersion,
  }
}
