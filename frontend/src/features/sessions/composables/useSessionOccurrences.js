import { computed, onBeforeUnmount, onMounted, ref, toValue } from 'vue'
import { createSessionOccurrence, deleteSessionOccurrence, getSessionOccurrences, updateSessionOccurrence } from '@/shared/api/sessionOccurrencesApi'
import { groupOccurrences, nextOccurrenceNumber } from '../lib/sessionOccurrences'

export function useSessionOccurrences(sessionUuid, { locked = false } = {}) {
  const occurrences = ref([]), loading = ref(true), busy = ref(false), error = ref('')
  const draft = ref(null), removing = ref(null)
  // Re-evaluate the day on refresh, including a tab left open overnight.
  const today = ref(new Date())
  const groups = computed(() => groupOccurrences(occurrences.value, `${today.value.getFullYear()}-${String(today.value.getMonth() + 1).padStart(2, '0')}-${String(today.value.getDate()).padStart(2, '0')}`))
  let disposed = false, version = 0, timer
  function apply(response) { occurrences.value = response.occurrences || []; today.value = new Date() }
  async function load(quiet = false) {
    if (quiet && (draft.value || removing.value || busy.value || toValue(locked))) return
    const request = ++version
    if (!quiet) loading.value = true
    try {
      const response = await getSessionOccurrences(sessionUuid)
      if (disposed || request !== version) return
      apply(response); error.value = ''
    } catch (reason) {
      if (!disposed && request === version && !quiet) error.value = reason.message || 'Не удалось загрузить сессии'
    } finally { if (!disposed && request === version) loading.value = false }
  }
  function edit(occurrence = null) {
    version += 1; error.value = ''
    draft.value = occurrence ? { ...occurrence, date: occurrence.date || '' } : { number: nextOccurrenceNumber(occurrences.value), name: '', date: '' }
  }
  async function mutate(request) {
    if (busy.value) return false
    version += 1; busy.value = true; error.value = ''
    try { const response = await request(); if (!disposed) apply(response); return true }
    catch (reason) { if (!disposed) error.value = reason.message || 'Не удалось сохранить сессию'; return false }
    finally { busy.value = false }
  }
  async function save(value) {
    const data = { number: Number(value.number), name: value.name.trim(), date: value.date, expectedChangedAt: value.changedAt }
    const saved = await mutate(() => value.id ? updateSessionOccurrence(sessionUuid, value.id, data) : createSessionOccurrence(sessionUuid, data))
    if (saved) draft.value = null
    return saved
  }
  async function remove() {
    const saved = await mutate(() => deleteSessionOccurrence(sessionUuid, removing.value.id))
    if (saved) removing.value = null
    return saved
  }
  function visibility() { if (document.visibilityState === 'visible') load(true) }
  onMounted(() => { load(); timer = setInterval(() => load(true), 12000); document.addEventListener('visibilitychange', visibility) })
  onBeforeUnmount(() => { disposed = true; version += 1; clearInterval(timer); document.removeEventListener('visibilitychange', visibility) })
  return { occurrences, loading, busy, error, groups, draft, removing, load, edit, save, remove }
}
