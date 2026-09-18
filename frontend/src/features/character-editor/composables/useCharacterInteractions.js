import { computed, onBeforeUnmount, reactive, watch } from 'vue'
import * as api from '@/shared/api/sessionInteractionsApi'
import { useSessionEventsStore } from '@/stores/sessionEvents'
import { interactionPeer, interactionPeerName, isInteraction } from '@/features/sessions/lib/sessionInteractions'

export function useCharacterInteractions({ uuid, session, isOwner, closePopover }) {
  const events = useSessionEventsStore()
  const state = reactive({ pending: [], history: [], peer: null, mode: 'chat', loading: false, busy: false, error: '', hasMore: false })
  const incomingCount = computed(() => state.pending.filter(event => event.data.recipientCharUuid === uuid).length)
  const currentRound = computed(() => state.pending.find(event => event.type === 'rps_challenge' && interactionPeer(event, uuid) === state.peer?.charUuid))
  let generation = 0
  let refreshing = null
  let refreshPending = false
  let pendingSend = null
  let conversationTask = Promise.resolve()
  let disposed = false
  const unregister = events.registerReader({
    sessionUuid: () => session.value?.uuid,
    isReading: event => isInteraction(event) && state.peer?.charUuid === interactionPeer(event, uuid) && (state.mode === 'chat' || event.type === 'rps_challenge'),
    actionFor: event => isInteraction(event) && isOwner.value
      ? { label: event.type === 'chat_message' ? 'Открыть чат' : 'Ответить на вызов', run: () => openEvent(event) } : null,
  })

  function loadConversation(options = {}) {
    const token = generation
    const task = conversationTask.catch(() => {}).then(() => {
      if (!disposed && token === generation) return readConversation(options)
    })
    conversationTask = task
    return task
  }
  async function readConversation({ older = false } = {}) {
    const peer = state.peer?.charUuid
    const sessionUuid = session.value?.uuid
    if (!peer || !sessionUuid || !isOwner.value) return
    const token = generation
    const oldest = state.history[0]?.id || 0
    let before = older ? oldest : 0
    const loaded = []
    let response
    do {
      response = await api.getInteractions(uuid, sessionUuid, { peer, before })
      if (disposed || token !== generation) return
      loaded.push(...response.events)
      before = response.events.at(-1)?.id || 0
      // Refresh the visible history, including old rounds whose status changed.
    } while (!older && oldest && response.hasMore && before > oldest)
    const retained = older ? state.history : []
    state.history = [...new Map([...retained, ...loaded].map(event => [event.id, event])).values()].sort((a, b) => a.id - b.id)
    state.hasMore = response.hasMore
    const unread = state.pending.filter(event => event.type === 'chat_message' && event.data.senderCharUuid === peer && event.data.recipientCharUuid === uuid)
    const through = Math.max(0, ...loaded.map(event => event.id))
    if (state.mode === 'chat' && unread.some(event => event.id <= through)) {
      await api.readMessages(uuid, sessionUuid, peer, through)
      if (disposed || token !== generation) return
      state.pending = state.pending.filter(event => !unread.some(read => read.id === event.id && read.id <= through))
    }
  }
  async function refresh() {
    if (!session.value?.uuid || !isOwner.value || disposed) return
    refreshPending = true
    if (refreshing) return refreshing
    refreshing = (async () => {
      try {
        while (refreshPending && !disposed) {
          refreshPending = false
          const id = session.value?.uuid
          const token = generation
          if (!id || !isOwner.value) return
          const response = await api.getInteractions(uuid, id)
          if (disposed || token !== generation) { refreshPending = true; continue }
          state.pending = response.events || []
          events.notifyInteractionOffers(id, state.pending)
          await loadConversation()
        }
      } catch (error) { if (!disposed) state.error = error.message || 'Не удалось загрузить сообщения и вызовы' }
      finally { refreshing = null }
    })()
    return refreshing
  }
  async function open(peer, mode = 'chat') {
    generation++
    closePopover()
    state.peer = peer
    state.mode = mode
    state.history = []
    state.hasMore = false
    state.error = ''
    state.loading = true
    await refresh()
    state.loading = false
  }
  function openEvent(event) {
    return open({ charUuid: interactionPeer(event, uuid), name: interactionPeerName(event, uuid),
      imageUrl: event.data.senderCharUuid === uuid ? event.recipientImageUrl : event.actorImageUrl }, event.type === 'chat_message' ? 'chat' : 'rps')
  }
  function close() {
    if (state.busy) return
    generation++
    state.peer = null
    state.error = ''
  }
  async function mutate(action) {
    if (state.busy || !state.peer || !isOwner.value) return false
    state.busy = true
    state.error = ''
    const token = generation
    try {
      await action()
      if (token !== generation) return false
      await Promise.all([refresh(), events.refresh()])
      return true
    } catch (error) {
      if (token === generation) state.error = error.message || 'Не удалось отправить'
      await refresh()
      return false
    } finally { state.busy = false }
  }
  async function send(type, value) {
    const request = { sessionUuid: session.value?.uuid, recipientCharUuid: state.peer?.charUuid, type,
      ...(type === 'chat_message' ? { message: value.trim() } : { choice: value }) }
    const key = JSON.stringify(request)
    if (pendingSend?.key !== key) pendingSend = { key, clientActionId: crypto.randomUUID() }
    const sent = await mutate(() => api.createInteraction(uuid, { ...request, clientActionId: pendingSend.clientActionId }))
    if (sent) pendingSend = null
    return sent
  }
  async function resolve(event, decision) { return mutate(() => api.resolveInteraction(uuid, event.id, decision)) }
  async function loadOlder() {
    if (state.loading) return
    state.loading = true
    try { await loadConversation({ older: true }) }
    catch (error) { state.error = error.message || 'Не удалось загрузить историю' }
    finally { state.loading = false }
  }
  watch(() => state.mode, () => { if (state.peer) void refresh() })
  watch(() => [session.value?.uuid, isOwner.value], () => {
    generation++
    state.peer = null
    state.pending = []
    state.history = []
    state.error = ''
    pendingSend = null
  })
  onBeforeUnmount(() => { disposed = true; generation++; unregister() })
  return reactive({ state, incomingCount, currentRound, open, openEvent, close, refresh, send, resolve, loadOlder })
}
