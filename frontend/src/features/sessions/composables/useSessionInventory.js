import { onBeforeUnmount, reactive, unref, watch } from 'vue'
import * as api from '@/shared/api/sessionInventoryApi'
import { getSession } from '@/shared/api/sessionsApi'
import { resolveSessionApplication } from '@/shared/api/itemTransfersApi'
import { itemsApi } from '@/shared/api/itemsApi'
import { useSessionEventsStore } from '@/stores/sessionEvents'
import { useTemplateStore } from '@/stores/template'
import { useSessionLive } from './useSessionLive'
import { createWeaponInstance } from '@/features/character-editor/lib/magicWeapons'

export function useSessionInventory(sessionUuid) {
  const state = reactive({ entries: [], transfers: [], players: [], items: {}, busy: false, loading: false, error: '', retry: null })
  const events = useSessionEventsStore()
  let loaded = false
  let generation = 0
  let refreshing = null
  let refreshPending = false
  async function refresh() {
    if (!loaded) return
    refreshPending = true
    if (refreshing) return refreshing
    const token = generation
    const task = (async () => {
      state.loading = true
      try {
        while (refreshPending && token === generation) {
          refreshPending = false
          const uuid = unref(sessionUuid)
          const [inventory, session] = await Promise.all([api.getSessionInventory(uuid), getSession(uuid), useTemplateStore().ensure()])
          if (token !== generation) return
          state.entries = inventory.entries || []
          state.transfers = inventory.transfers || []
          state.players = session.participants || []
          const ids = [...new Set([...state.entries, ...state.transfers].map(row => Number(row.entry?.magic_item_id || row.entry?.item_id)).filter(Boolean))]
          const missing = ids.filter(id => !state.items[id])
          if (missing.length) {
            try {
              const response = await itemsApi.byIds(missing)
              if (token === generation) state.items = { ...state.items, ...Object.fromEntries((response.items || []).map(item => [item.id, item])) }
            } catch { /* The reference dialog can retry; entries remain usable. */ }
          }
        }
      } catch (error) { if (token === generation) state.error = error.message || 'Не удалось загрузить инвентарь' }
      finally { if (token === generation) { state.loading = false; refreshing = null } }
    })()
    refreshing = task
    return task
  }
  async function open() { loaded = true; state.error = ''; await refresh(); live.start() }
  async function mutate(operation) {
    if (state.busy) return false
    const token = generation
    state.busy = true; state.error = ''; state.retry = null
    try {
      await operation()
      if (token !== generation) return false
      await Promise.all([refresh(), events.refresh()])
      return true
    } catch (error) {
      if (token === generation) {
        state.error = error.message || 'Не удалось изменить инвентарь'
        state.retry = () => mutate(operation)
        await refresh()
      }
      return false
    } finally { if (token === generation) state.busy = false }
  }
  function add(item, quantity = 1, params = {}) {
    const uuid = unref(sessionUuid)
    const source = Number(item.typeId) === 10 ? 'potions' : Number(item.typeId) === 1 || (Number(item.typeId) === 19 && item.data?.weapon) ? 'weapon' : 'items'
    const entry = { item_id: item.id, count: quantity, params, ...(source === 'potions' ? { name: item.name } : {}) }
    const request = { source, name: item.name, entry: source === 'weapon' ? createWeaponInstance(item, entry) : entry, clientActionId: crypto.randomUUID() }
    return mutate(() => api.addSessionInventory(uuid, request))
  }
  function addCustom(name, count, description) {
    const uuid = unref(sessionUuid)
    const request = { source: 'items', name, entry: { count, override: { name, desc: description } }, clientActionId: crypto.randomUUID() }
    return mutate(() => api.addSessionInventory(uuid, request))
  }
  function remove(row) { const uuid = unref(sessionUuid); return mutate(() => api.deleteSessionInventory(uuid, row.id)) }
  function send(row, player) {
    const uuid = unref(sessionUuid)
    const request = { recipientCharUuid: player.charUuid, clientActionId: crypto.randomUUID() }
    return mutate(() => api.sendSessionInventory(uuid, row.id, request))
  }
  function resolve(offer, decision) {
    const uuid = unref(sessionUuid)
    return mutate(() => resolveSessionApplication(uuid, offer.eventId, decision))
  }
  const live = useSessionLive({ sessionUuid, onCatchUp: refresh, onUpdate: update => { if (update.journal || update.participants) return refresh() } })
  watch(sessionUuid, () => { generation++; live.stop(); loaded = false; refreshing = null; refreshPending = false; Object.assign(state, { entries: [], transfers: [], players: [], items: {}, busy: false, loading: false, error: '', retry: null }) })
  onBeforeUnmount(() => { generation++; live.stop() })
  return { state, open, refresh, add, addCustom, remove, send, resolve }
}
