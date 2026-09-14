import { computed, onBeforeUnmount, reactive, shallowRef, watch } from 'vue'
import * as api from '@/shared/api/itemTransfersApi'
import { getSession } from '@/shared/api/sessionsApi'
import { useTemplateStore } from '@/stores/template'
import { useSessionEventsStore } from '@/stores/sessionEvents'
import { useSessionLive } from '@/features/sessions/composables/useSessionLive'

export function useCharacterTransfers({ uuid, session, isOwner, version, flushSave, refreshFromServer, saveStatus, loadSessions }) {
  const state = reactive({ participants: [], playersLoaded: false, transfers: [], view: '', selection: null, recipient: '', loading: false, busy: false, error: '' })
  const anchor = shallowRef(null)
  const anchors = new Map()
  function registerAnchor(view, element) {
    if (!anchors.has(view)) anchors.set(view, new Set())
    anchors.get(view).add(element)
  }
  function unregisterAnchor(view, element) { anchors.get(view)?.delete(element) }
  const events = useSessionEventsStore()
  const incomingCount = computed(() => state.transfers.filter(t => t.recipientCharUuid === uuid).length)
  const recipients = computed(() => state.participants.filter(p => p.charUuid !== uuid))
  let refreshing = null
  let refreshPending = false

  async function refresh() {
    if (!isOwner.value || !session.value?.uuid) return
    refreshPending = true
    if (refreshing) return refreshing
    refreshing = (async () => {
      try {
        while (refreshPending && session.value?.uuid) {
          refreshPending = false
          const sessionUuid = session.value.uuid
          const response = await api.getItemTransfers(uuid)
          if (session.value?.uuid === sessionUuid) state.transfers = response.transfers || []
        }
      } catch (error) { state.error = error.message || 'Не удалось загрузить события' }
      finally { refreshing = null }
    })()
    return refreshing
  }
  async function loadPlayers() {
    const id = session.value?.uuid
    if (!id) return
    state.loading = true
    try {
      await useTemplateStore().ensure()
      const response = await getSession(id)
      if (session.value?.uuid === id) { state.participants = response.participants || []; state.playersLoaded = true }
    } catch (error) { state.error = error.message || 'Не удалось загрузить игроков' }
    finally { state.loading = false }
  }
  async function open(view, element) {
    if (state.busy) return
    if (view !== 'send') anchor.value = element || [...(anchors.get(view) || [])].find(el => el.getClientRects().length) || null
    state.error = ''
    state.view = view
    if (view === 'players' || view === 'send') await loadPlayers()
    else await refresh()
  }
  function select(source, entry, name) {
    if (!isOwner.value || !session.value || state.busy) return
    state.selection = { source, entryUid: entry.uid, name, count: entry.count || 1, clientActionId: crypto.randomUUID() }
    state.recipient = ''
    void open('send')
  }
  function close() { if (!state.busy) state.view = '' }

  async function mutate(action) {
    if (state.busy) return false
    state.busy = true
    state.error = ''
    try {
      if (!await flushSave()) throw new Error('Сначала сохраните лист. Если он изменился на сервере, обновите страницу.')
      await action()
      if (!await refreshFromServer()) throw new Error('Передача сохранена. Не удалось обновить инвентарь; обновите страницу.')
      await refresh()
      await events.refresh()
      return true
    } catch (error) {
      state.error = error.message || 'Не удалось выполнить передачу'
      // The request may have committed even when its response was lost.
      if (saveStatus.value === 'idle') await refreshFromServer()
      await refresh()
      return false
    } finally { state.busy = false }
  }
  async function send() {
    if (!state.selection || !state.recipient || !session.value) return
    const sent = await mutate(() => api.createItemTransfer(uuid, {
      ...state.selection, sessionUuid: session.value.uuid, recipientCharUuid: state.recipient, version: version.value,
    }))
    if (sent) { state.selection = null; await open('events') }
  }
  async function resolve(transfer, decision) {
    await mutate(() => api.resolveItemTransfer(uuid, transfer.id, decision))
  }
  async function catchUp() {
    await Promise.all([refresh(), loadSessions(), events.refresh()])
    await loadPlayers()
    if (!state.busy && saveStatus.value === 'idle') await refreshFromServer(() => !state.busy && saveStatus.value === 'idle')
  }
  const live = useSessionLive({
    sessionUuid: computed(() => session.value?.uuid),
    onCatchUp: catchUp,
    onUpdate: async update => {
      if (update.journal) await refresh()
      if (update.participants || update.session) { await loadSessions(); await loadPlayers() }
      if (update.characterIds?.length && !state.busy && saveStatus.value === 'idle') {
        await refreshFromServer(() => !state.busy && saveStatus.value === 'idle')
      }
    },
  })
  watch(() => session.value?.uuid, id => {
    live.stop()
    state.participants = []
    state.playersLoaded = false
    state.transfers = []
    if (id && isOwner.value) { void refresh(); void loadPlayers(); live.start() }
    else state.view = ''
  }, { immediate: true })
  onBeforeUnmount(live.stop)
  return reactive({ state, anchor, registerAnchor, unregisterAnchor, incomingCount, recipients, open, select, close, send, resolve, refresh, busy: computed(() => state.busy) })
}
