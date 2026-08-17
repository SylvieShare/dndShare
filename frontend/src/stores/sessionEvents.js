import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as sessionEventsApi from '@/shared/api/sessionEventsApi'

function actionId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const random = Math.floor(Math.random() * 16)
    const value = char === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

export const useSessionEventsStore = defineStore('session-events', () => {
  const sessionUuid = ref(null)
  const actorCharUuid = ref(null)
  const events = ref([])
  const loading = ref(false)
  const syncError = ref(false)
  let refreshPending = false
  let refreshPromise = null

  function merge(incoming) {
    if (!Array.isArray(incoming) || incoming.length === 0) return
    const byId = new Map(events.value.map(event => [event.id, event]))
    for (const event of incoming) byId.set(event.id, event)
    events.value = [...byId.values()].sort((a, b) => a.id - b.id).slice(-200)
  }

  function latestId() {
    return events.value.at(-1)?.id || 0
  }

  function refresh() {
    if (!sessionUuid.value) return Promise.resolve()
    refreshPending = true
    if (refreshPromise) return refreshPromise
    refreshPromise = (async () => {
      try {
        while (refreshPending && sessionUuid.value) {
          refreshPending = false
          const uuid = sessionUuid.value
          const response = await sessionEventsApi.getSessionEvents(uuid, { after: latestId(), limit: 100 })
          if (sessionUuid.value === uuid) merge(response?.events)
        }
        syncError.value = false
      } catch {
        syncError.value = true
      } finally {
        refreshPromise = null
        if (refreshPending) refresh()
      }
    })()
    return refreshPromise
  }

  async function setContext({ uuid, actorUuid = null }) {
    if (!uuid) {
      clearContext()
      return
    }
    if (sessionUuid.value === uuid) {
      setActor(actorUuid, uuid)
      return
    }
    sessionUuid.value = uuid
    actorCharUuid.value = actorUuid || null
    events.value = []
    loading.value = true
    try {
      const response = await sessionEventsApi.getSessionEvents(uuid, { limit: 50 })
      if (sessionUuid.value === uuid) merge(response?.events)
      syncError.value = false
    } catch {
      syncError.value = true
    } finally {
      loading.value = false
    }
  }

  function setActor(actorUuid = null, expectedUuid = null) {
    if (expectedUuid && sessionUuid.value !== expectedUuid) return
    actorCharUuid.value = actorUuid || null
  }

  function clearContext(expectedUuid = null) {
    if (expectedUuid && sessionUuid.value !== expectedUuid) return
    sessionUuid.value = null
    actorCharUuid.value = null
    events.value = []
    loading.value = false
  }

  async function publish({ type, action, data = {}, visibility = 'public', actor = undefined }) {
    const uuid = sessionUuid.value
    if (!uuid) return null
    try {
      const eventActor = actor === undefined
        ? { charUuid: actorCharUuid.value, name: null }
        : { charUuid: actor?.charUuid || null, name: String(actor?.name || '').trim() || null }
      const response = await sessionEventsApi.createSessionEvent(uuid, {
        type,
        action,
        data,
        visibility,
        actorCharUuid: eventActor.charUuid,
        actorName: eventActor.name,
        clientActionId: actionId(),
      })
      if (sessionUuid.value === uuid && response?.event) merge([response.event])
      return response?.event || null
    } catch {
      syncError.value = true
      return null
    }
  }

  function pendingCharacterEvent({ type, action, data = {}, visibility = 'public' }) {
    if (!sessionUuid.value) return null
    return {
      sessionUuid: sessionUuid.value,
      type,
      action,
      data,
      visibility,
      clientActionId: actionId(),
    }
  }

  return {
    sessionUuid,
    actorCharUuid,
    events,
    loading,
    syncError,
    setContext,
    setActor,
    clearContext,
    publish,
    pendingCharacterEvent,
    refresh,
  }
})
