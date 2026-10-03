import { computed, ref, toValue, watch } from 'vue'
import { useJournalWorkspace } from '@/features/journals/composables/useJournalWorkspace'
import { useJournalEntries } from '@/features/journals/composables/useJournalEntries'
import { useSessionOccurrences } from './useSessionOccurrences'
import { localDate, occurrenceGroups, preferredOccurrence } from '../lib/sessionOccurrences'

function rememberedOccurrence(uuid) {
  try { return Number(localStorage.getItem(`dnd-share:session-journal:v1:${uuid}`)) || null }
  catch { return null }
}

export function useSessionJournal(sessionUuid, requestedId) {
  const journal = useJournalWorkspace({ sessionUuid })
  const selectedId = ref(rememberedOccurrence(sessionUuid))
  const sections = computed(() => new Map((journal.journal.value?.sections || []).map(section => [section.occurrenceId, section])))
  const selectedSection = computed(() => sections.value.get(selectedId.value) || null)
  const entries = useJournalEntries(journal, selectedSection)
  const schedule = useSessionOccurrences(sessionUuid, { locked: entries.locked })
  const syncing = ref(false)
  const locked = computed(() => entries.locked.value || schedule.busy.value || syncing.value || Boolean(schedule.draft.value || schedule.removing.value || entries.removingEvent.value))
  const loading = computed(() => journal.loading.value || schedule.loading.value)
  const busy = computed(() => journal.busy.value || schedule.busy.value || syncing.value)
  const selectedOccurrence = computed(() => schedule.occurrences.value.find(row => row.id === selectedId.value) || null)
  const groups = computed(() => {
    const source = schedule.groups.value
    const withCount = row => ({ ...row, entryCount: sections.value.get(row.id)?.events.length ?? row.entryCount })
    return occurrenceGroups(source, withCount)
  })
  const selectedStatus = computed(() => {
    const row = selectedOccurrence.value
    if (!row?.date) return 'Без даты'
    if (row.date === localDate()) return 'Сегодня'
    if (row.date < localDate()) return 'Прошла'
    return row.id === schedule.groups.value.next?.id ? 'Следующая' : 'Запланирована'
  })
  const error = computed(() => journal.error.value || (!schedule.draft.value && !schedule.removing.value ? schedule.error.value : ''))
  function select(id) {
    id = Number(id)
    if (locked.value || !schedule.occurrences.value.some(row => row.id === id)) return
    selectedId.value = id
  }
  let appliedRequest = null
  watch([() => toValue(requestedId), schedule.occurrences, schedule.loading], () => {
    if (locked.value || schedule.loading.value) return
    const rows = schedule.occurrences.value
    const wanted = Number(toValue(requestedId))
    if (wanted && wanted !== appliedRequest && rows.some(row => row.id === wanted)) { selectedId.value = wanted; appliedRequest = wanted }
    else if (!rows.some(row => row.id === selectedId.value)) selectedId.value = preferredOccurrence(rows)?.id || null
  }, { immediate: true })
  watch(selectedId, id => {
    if (!id) return
    try { localStorage.setItem(`dnd-share:session-journal:v1:${sessionUuid}`, String(id)) } catch { /* Storage is optional. */ }
  })
  async function reload() {
    if (locked.value) return
    await Promise.allSettled([journal.load(), schedule.load()])
  }
  async function saveOccurrence(draft) {
    const before = new Set(schedule.occurrences.value.map(row => row.id))
    if (!await schedule.save(draft)) return
    syncing.value = true
    try {
      await journal.load({ quiet: true })
      selectedId.value = draft.id || schedule.occurrences.value.find(row => !before.has(row.id))?.id || selectedId.value
    } finally { syncing.value = false }
  }
  async function removeOccurrence() {
    if (!await schedule.remove()) return
    syncing.value = true
    try {
      await journal.load({ quiet: true })
      if (!schedule.occurrences.value.some(row => row.id === selectedId.value)) selectedId.value = preferredOccurrence(schedule.occurrences.value)?.id || null
    } finally { syncing.value = false }
  }
  return {
    ...entries, journal: journal.journal, canEdit: journal.canEdit, canManage: journal.canManage,
    loading, busy, locked, error, groups, selectedId, selectedSection, selectedOccurrence, selectedStatus,
    occurrenceDraft: schedule.draft, removingOccurrence: schedule.removing, occurrenceError: schedule.error,
    select, reload, editOccurrence: schedule.edit, saveOccurrence, removeOccurrence,
    updateEntry: journal.updateEntry, reorderEntries: journal.reorderEntries, setPlayerEditing: journal.setPlayerEditing,
  }
}
