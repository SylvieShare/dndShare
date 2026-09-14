import { defineStore } from 'pinia'
import { onScopeDispose, ref, toRaw } from 'vue'
import * as sessionEventsApi from '@/shared/api/sessionEventsApi'
import { useAccountStore } from '@/stores/account'
import { useNotificationsStore } from '@/stores/notifications'
import { isInteraction } from '@/features/sessions/lib/sessionInteractions'
import { sessionEventSignature } from '@/features/notifications/lib/sessionEventChanges'

function actionId() { return globalThis.crypto.randomUUID() }

export const useSessionEventsStore = defineStore('session-events', () => {
  const sessionUuid = ref(null)
  const actorCharUuid = ref(null)
  const events = ref([])
  const loading = ref(false)
  const syncError = ref(false)
  const newEventIds = ref(new Set())
  const notifications = useNotificationsStore()
  const account = useAccountStore()
  const readers = new Map()
  const signatures = new Map()
  const localActions = new Set()
  const notifiedOffers = new Set()
  const localRolls = new WeakSet()
  const arrivalTimers = new Map()
  let lastReadId = 0
  let initialized = false
  let generation = 0
  let initialPromise = null
  let refreshPending = false
  let refreshPromise = null

  function registerReader(reader) {
    const key = Symbol('session-event-reader')
    readers.set(key, reader)
    return () => readers.delete(key)
  }
  function activeReaders(uuid) { return [...readers.values()].filter(entry => entry.sessionUuid() === uuid).reverse() }
  function markLocalRoll(result) { if (result && typeof result === 'object') localRolls.add(toRaw(result)) }
  function rememberLocalAction(id) {
    localActions.add(id)
    if (localActions.size > 400) localActions.delete(localActions.values().next().value)
  }
  function markArrival(id) {
    newEventIds.value = new Set([...newEventIds.value, id])
    clearTimeout(arrivalTimers.get(id))
    arrivalTimers.set(id, setTimeout(() => {
      const next = new Set(newEventIds.value)
      next.delete(id)
      newEventIds.value = next
      arrivalTimers.delete(id)
    }, 700))
  }
  function notifyEvent(event, updated, uuid = sessionUuid.value) {
    const userId = Number(account.user?.id)
    const actingUserId = event.type === 'rps_challenge' && event.data?.resolvedByUserId ? event.data.resolvedByUserId : event.authorUserId
    if (!userId || Number(actingUserId) === userId) return
    const isOwner = Number(event.sessionOwnerUserId) === userId
    const directedInteraction = isInteraction(event) && [Number(event.recipientUserId), Number(event.authorUserId)].includes(userId)
    if (!isOwner && !directedInteraction && !(event.type === 'item_transfer' && Number(event.recipientUserId) === userId && event.data?.status === 'pending')) return
    if (localActions.has(event.clientActionId) || activeReaders(uuid).some(entry => entry.isReading?.(event))) return
    const key = `session:${uuid}:event:${event.id}`
    const offerKey = `${userId}:${key}`
    const isOffer = (event.type === 'item_transfer' || isInteraction(event)) && (!event.data?.status || event.data.status === 'pending')
    if (isOffer && notifiedOffers.has(offerKey)) return
    const action = activeReaders(uuid).map(entry => entry.actionFor?.(event)).find(Boolean)
    const id = notifications.notify({
      type: 'session-event', title: event.action, key,
      scope: `session:${uuid}`, data: { event, updated }, duration: event.type === 'item_transfer' ? 10000 : 6000,
      actions: action ? [{ key: 'open', label: action.label }] : [],
      onAction: () => { action?.run(); notifications.dismiss(id) },
    })
    if (isOffer) {
      notifiedOffers.add(offerKey)
      if (notifiedOffers.size > 500) notifiedOffers.delete(notifiedOffers.values().next().value)
    }
  }
  function notifyInteractionOffers(uuid, incoming) {
    for (const event of incoming || []) {
      if (Number(event.recipientUserId) === Number(account.user?.id)) notifyEvent(event, false, uuid)
    }
  }
  function notifyTransferOffers(uuid, transfers) {
    const userId = Number(account.user?.id)
    for (const transfer of transfers || []) {
      if (!transfer.eventId || !transfer.authorUserId || Number(transfer.recipientUserId) !== userId || transfer.status !== 'pending') continue
      const entry = transfer.entry || {}
      notifyEvent({
        id: transfer.eventId, type: 'item_transfer', authorUserId: transfer.authorUserId,
        recipientUserId: transfer.recipientUserId, sessionOwnerUserId: transfer.sessionOwnerUserId,
        actorCharUuid: transfer.senderCharUuid, actorName: transfer.senderName, actorImageUrl: transfer.senderImageUrl,
        action: `Передача: ${transfer.itemName}`, createdAt: transfer.createdAt,
        data: { status: transfer.status, senderName: transfer.senderName, recipientName: transfer.recipientName,
          source: { itemId: entry.magic_item_id || entry.item_id || null, name: transfer.itemName }, count: entry.count },
      }, false, uuid)
    }
  }
  function notifyInitialOffers(incoming) {
    for (const event of incoming || []) {
      if (event.type === 'item_transfer' && event.data?.status === 'pending' && Number(event.recipientUserId) === Number(account.user?.id) && Number(event.sessionOwnerUserId) !== Number(account.user?.id)) notifyEvent(event, false)
    }
  }
  function merge(incoming, { quiet = false, updates = false, fromRead = false } = {}) {
    if (!Array.isArray(incoming) || !incoming.length) return
    const byId = new Map(events.value.map(event => [event.id, event]))
    for (const event of incoming) {
      if (fromRead) lastReadId = Math.max(lastReadId, event.id)
      const previous = signatures.get(event.id)
      const signature = sessionEventSignature(event)
      signatures.set(event.id, signature)
      if (!updates || byId.has(event.id)) byId.set(event.id, event)
      if (quiet || previous === signature || (updates && previous == null)) continue
      if (previous == null) markArrival(event.id)
      notifyEvent(event, previous != null)
    }
    events.value = [...byId.values()].sort((a, b) => a.id - b.id).slice(-200)
    // Keep recent transfer baselines even after their rows leave the visible window.
    while (signatures.size > 600) signatures.delete(signatures.keys().next().value)
  }
  function latestId() { return lastReadId }

  function refresh() {
    if (!sessionUuid.value) return Promise.resolve()
    const token = generation
    if (loading.value && initialPromise) return initialPromise.then(() => token === generation ? refresh() : undefined)
    refreshPending = true
    if (refreshPromise) return refreshPromise
    const task = (async () => {
      try {
        while (refreshPending && sessionUuid.value && token === generation) {
          refreshPending = false
          const response = await sessionEventsApi.getSessionEvents(sessionUuid.value, { after: latestId(), limit: 100 })
          if (token !== generation) return
          merge(response?.updates, { quiet: !initialized, updates: true })
          merge(response?.events, { quiet: !initialized, fromRead: true })
          if (!initialized) notifyInitialOffers(response?.events)
          initialized = true
          // Drain bursts larger than one page without waiting for another invalidation.
          if (response?.events?.length === 100) refreshPending = true
        }
        if (token === generation) syncError.value = false
      } catch { if (token === generation) syncError.value = true }
      finally {
        if (refreshPromise === task) {
          refreshPromise = null
          if (refreshPending) void refresh()
        }
      }
    })()
    refreshPromise = task
    return task
  }

  async function setContext({ uuid, actorUuid = null }) {
    if (!uuid) { clearContext(); return }
    if (sessionUuid.value === uuid) { setActor(actorUuid, uuid); return initialPromise }
    clearContext()
    sessionUuid.value = uuid
    actorCharUuid.value = actorUuid || null
    loading.value = true
    const token = generation
    initialPromise = (async () => {
      try {
        const response = await sessionEventsApi.getSessionEvents(uuid, { limit: 50 })
        if (token !== generation) return
        merge(response?.events, { quiet: true, fromRead: true })
        notifyInitialOffers(response?.events)
        initialized = true
        syncError.value = false
      } catch { if (token === generation) syncError.value = true }
      finally { if (token === generation) loading.value = false }
    })()
    return initialPromise
  }
  function setActor(actorUuid = null, expectedUuid = null) {
    if (!expectedUuid || sessionUuid.value === expectedUuid) actorCharUuid.value = actorUuid || null
  }
  function clearContext(expectedUuid = null) {
    if (expectedUuid && sessionUuid.value !== expectedUuid) return
    if (sessionUuid.value) notifications.clear(`session:${sessionUuid.value}`)
    generation++
    initialized = false
    lastReadId = 0
    initialPromise = refreshPromise = null
    refreshPending = false
    sessionUuid.value = actorCharUuid.value = null
    events.value = []
    loading.value = syncError.value = false
    signatures.clear()
    localActions.clear()
    arrivalTimers.forEach(clearTimeout)
    arrivalTimers.clear()
    newEventIds.value = new Set()
  }

  async function publish({ type, action, data = {}, visibility = 'public', actor = undefined, notify = true }) {
    const uuid = sessionUuid.value
    const token = generation
    if (!uuid) return null
    const clientActionId = actionId()
    if (!notify || (data.result && localRolls.has(toRaw(data.result)))) rememberLocalAction(clientActionId)
    try {
      const eventActor = actor === undefined ? { charUuid: actorCharUuid.value, itemId: null, name: null }
        : { charUuid: actor?.charUuid || null, itemId: actor?.itemId == null ? null : Number(actor.itemId), name: String(actor?.name || '').trim() || null }
      const response = await sessionEventsApi.createSessionEvent(uuid, {
        type, action, data, visibility, actorCharUuid: eventActor.charUuid, actorItemId: eventActor.itemId,
        actorName: eventActor.name, clientActionId,
      })
      if (token === generation && response?.event) merge([{ ...response.event, clientActionId }])
      return response?.event || null
    } catch { if (token === generation) syncError.value = true; return null }
  }
  function pendingCharacterEvent({ type, action, data = {}, visibility = 'public' }) {
    if (!sessionUuid.value) return null
    const clientActionId = actionId()
    if (data.result && localRolls.has(toRaw(data.result))) rememberLocalAction(clientActionId)
    return { sessionUuid: sessionUuid.value, type, action, data, visibility, clientActionId }
  }
  onScopeDispose(() => { clearContext(); readers.clear() })
  return { sessionUuid, actorCharUuid, events, loading, syncError, newEventIds, setContext, setActor, clearContext,
    publish, pendingCharacterEvent, refresh, registerReader, markLocalRoll, notifyTransferOffers, notifyInteractionOffers }
})
