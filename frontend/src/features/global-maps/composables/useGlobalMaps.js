import { computed, onBeforeUnmount, ref } from 'vue'
import { activateGlobalMap, createGlobalMap, deleteGlobalMap, getGlobalMaps, saveGlobalMap } from '@/shared/api/globalMapsApi'
import { useMapSync } from '@/features/maps/composables/useMapSync'

export function useGlobalMaps(uuid) {
  const maps = ref([]), selectedId = ref(''), loading = ref(true), saving = ref(false)
  const busy = ref(false), editing = ref(false), error = ref(''), conflict = ref(false)
  const selected = computed(() => maps.value.find(map => map.id === selectedId.value))
  const pending = new Set(), versions = new Map()
  const pendingCount = ref(0)
  let timer, activeSave, reloadQueued = false, stopped = false
  const hasPending = () => pendingCount.value > 0 || saving.value || busy.value || editing.value

  async function load(force = false) {
    if (!force && hasPending()) { reloadQueued = true; return }
    try {
      const result = await getGlobalMaps(uuid)
      if (stopped) return
      if (!force && hasPending()) { reloadQueued = true; return }
      maps.value = result.maps
      if (!maps.value.some(map => map.id === selectedId.value)) selectedId.value = maps.value.find(map => map.current)?.id || maps.value[0]?.id || ''
      if (force) { pending.clear(); pendingCount.value = 0; conflict.value = false; clearTimeout(timer) }
      error.value = ''
    } catch (cause) { error.value = cause.message; throw cause }
    finally { loading.value = false }
  }
  const { connected } = useMapSync(`/api/sessions/${uuid}/global-map-events`, load)

  function persist() {
    if (!selected.value || conflict.value) return
    const id = selected.value.id
    versions.set(id, (versions.get(id) || 0) + 1)
    pending.add(id)
    pendingCount.value = pending.size
    clearTimeout(timer)
    timer = setTimeout(flush, 400)
  }
  function change(fn) {
    if (!selected.value || conflict.value || busy.value) return
    fn(selected.value)
    persist()
  }
  async function savePending() {
    if (conflict.value || editing.value) return
    saving.value = true
    error.value = ''
    try {
      while (pending.size) {
        const id = pending.values().next().value, map = maps.value.find(map => map.id === id)
        if (!map) { pending.delete(id); pendingCount.value = pending.size; continue }
        const version = versions.get(id)
        const result = await saveGlobalMap(uuid, JSON.parse(JSON.stringify(map)))
        map.revision = result.revision
        if (versions.get(id) === version) pending.delete(id)
        pendingCount.value = pending.size
      }
    } catch (cause) { error.value = cause.message; conflict.value = cause.status === 409 }
    finally {
      saving.value = false
      if (reloadQueued && !hasPending() && !stopped) { reloadQueued = false; load().catch(() => {}) }
    }
  }
  function flush() {
    clearTimeout(timer)
    if (!activeSave) activeSave = savePending().finally(() => { activeSave = null })
    return activeSave
  }
  async function upload(file) {
    if (!file || busy.value) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 15 * 1024 * 1024) {
      error.value = 'Выберите PNG, JPG или WebP до 15 МБ'; return
    }
    if (maps.value.length >= 32) { error.value = 'В сессии может быть до 32 глобальных карт'; return }
    busy.value = true; error.value = ''
    try {
      const form = new FormData(); form.append('file', file)
      const response = await fetch('/api/storage/images', { method: 'POST', body: form })
      if (!response.ok) throw new Error('Не удалось загрузить изображение')
      const asset = await response.json()
      const map = await createGlobalMap(uuid, { name: file.name.replace(/\.[^.]+$/, '').slice(0, 160) || 'Глобальная карта', imageId: asset.upload_id })
      maps.value.forEach(item => { item.current = false })
      maps.value.push(map); selectedId.value = map.id
    } catch (cause) { error.value = cause.message }
    finally { busy.value = false }
  }
  async function activate(id) {
    if (busy.value) return
    busy.value = true
    try {
      await activateGlobalMap(uuid, id)
      maps.value.forEach(map => { map.current = map.id === id })
      selectedId.value = id
    } catch (cause) { error.value = cause.message }
    finally { busy.value = false }
  }
  async function remove(id) {
    await flush()
    if (hasPending()) return false
    busy.value = true
    try {
      await deleteGlobalMap(uuid, id)
      pending.delete(id)
      pendingCount.value = pending.size
      busy.value = false
      await load()
      return true
    } catch (cause) { error.value = cause.message; return false }
    finally { busy.value = false }
  }
  function unload(event) { if (hasPending()) { event.preventDefault(); event.returnValue = '' } }
  window.addEventListener('beforeunload', unload)
  onBeforeUnmount(() => { stopped = true; clearTimeout(timer); window.removeEventListener('beforeunload', unload) })
  return { maps, selectedId, selected, loading, saving, busy, editing, error, conflict, connected, hasPending, load, change, persist, flush, upload, activate, remove }
}
