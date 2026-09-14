import { usePotionApplications } from './usePotionApplications'
import { computed, onBeforeUnmount, reactive, shallowRef, watch } from 'vue'
import * as api from '@/shared/api/itemTransfersApi'
import { getSession } from '@/shared/api/sessionsApi'
import { useTemplateStore } from '@/stores/template'
import { useSessionEventsStore } from '@/stores/sessionEvents'
import { useCharacterInteractions } from './useCharacterInteractions'
import { useSessionLive } from '@/features/sessions/composables/useSessionLive'

export function useCharacterTransfers({ uuid, session, isOwner, version, flushSave, refreshFromServer, saveStatus, loadSessions }) {
  const state = reactive({ participants: [], playersLoaded: false, transfers: [], view: '', loading: false, busy: false, error: '' })
  const anchor = shallowRef(null)
  const anchors = new Map()
  function registerAnchor(view, element) {
    if (!anchors.has(view)) anchors.set(view, new Set())
    anchors.get(view).add(element)
  }
  function unregisterAnchor(view, element) { anchors.get(view)?.delete(element) }
  const events = useSessionEventsStore()
  const unregisterEventReader = events.registerReader({
    sessionUuid: () => session.value?.uuid,
    actionFor: event => event.type === 'item_transfer' && isOwner.value
      ? { label: 'Открыть события', run: () => open('events') } : null,
  })
  onBeforeUnmount(unregisterEventReader)
  const interactions = useCharacterInteractions({ uuid, session, isOwner, closePopover: close })
  const incomingCount = computed(() => state.transfers.filter(t => t.recipientCharUuid === uuid).length + interactions.incomingCount)
  const recipients = computed(() => state.participants.filter(p => p.charUuid !== uuid))
  let pendingSend = null
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
          const [response] = await Promise.all([api.getItemTransfers(uuid), interactions.refresh()])
          if (session.value?.uuid === sessionUuid) {
            state.transfers = response.transfers || []
            events.notifyTransferOffers(sessionUuid, state.transfers)
          }
        }
      } catch (error) { state.error = error.message || 'Не удалось загрузить события' }
      finally { refreshing = null }
    })()
    return refreshing
  }
  async function loadPlayers() {
    const id = session.value?.uuid
    if (!id) return
    state.error = ''
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
    anchor.value = element || [...(anchors.get(view) || [])].find(el => el.getClientRects().length) || null
    state.error = ''
    state.view = view
    if (view === 'players') await loadPlayers()
    else await refresh()
  }
  function close() { if (!state.busy) state.view = '' }

  async function mutate(action) {
    if (state.busy) return false
    state.busy = true
    state.error = ''
    try {
      if (!await flushSave()) throw new Error('Сначала сохраните лист. Если он изменился на сервере, обновите страницу.')
      await action()
      if (!await refreshFromServer()) throw new Error('Запрос сохранён. Не удалось обновить инвентарь; обновите страницу.')
      await refresh()
      await events.refresh()
      return true
    } catch (error) {
      state.error = error.message || 'Не удалось отправить или обработать запрос'
      // The request may have committed even when its response was lost.
      if (saveStatus.value === 'idle') await refreshFromServer()
      await refresh()
      return false
    } finally { state.busy = false }
  }
  const potions = usePotionApplications({ uuid, version, mutate, state, isOwner })
  async function send(source, entry, recipientCharUuid, purpose = 'transfer') {
    if (!isOwner.value || state.busy || !session.value || !recipients.value.some(p => p.charUuid === recipientCharUuid)) return false
    let optionKey = ''
    if (purpose === 'use') {
      try { optionKey = await potions.choose(entry) } catch (error) { state.error = error.message; return false }
      if (optionKey === null) return false
    }
    const key = `${optionKey}:${purpose}:${session.value.uuid}:${source}:${entry.uid}:${recipientCharUuid}`
    if (pendingSend?.key !== key) pendingSend = { key, clientActionId: crypto.randomUUID() }
    const payload = { optionKey, purpose, source, entryUid: entry.uid, recipientCharUuid, sessionUuid: session.value.uuid, clientActionId: pendingSend.clientActionId }
    const sent = await mutate(() => api.createItemTransfer(uuid, { ...payload, version: version.value }))
    if (sent) pendingSend = null
    return sent
  }
  async function resolve(transfer, decision) {
    let response
    if (await mutate(async () => { response = await api.resolveItemTransfer(uuid, transfer.id, decision) }) && decision === 'accept' && transfer.purpose === 'use') {
      potions.application.name = transfer.itemName
      potions.application.result = response.transfer.applicationResult
    }
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
      if (update.journal) await Promise.all([refresh(), events.refresh()])
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
  return reactive({ state, potions, interactions, anchor, registerAnchor, unregisterAnchor, incomingCount, recipients, loadPlayers, open, close, send, resolve, refresh, busy: computed(() => state.busy) })
}
