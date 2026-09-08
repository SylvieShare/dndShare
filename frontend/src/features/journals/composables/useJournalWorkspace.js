import { onBeforeUnmount, onMounted, ref } from 'vue'
import {
  createCharacterJournal,
  createJournalEntry,
  createJournalSection,
  createSessionJournal,
  deleteJournalEntry,
  deleteJournalSection,
  getCharacterJournal,
  getSessionJournal,
  setCharacterJournal,
  setJournalPlayerEditing,
  reorderJournalEntries,
  updateJournalEntry,
  updateJournalSection,
} from '@/shared/api/journalsApi'
import { normalizeEvent } from '@/features/character-editor/blocks/dnd/lib/diaryEntry'

function normalizedJournal(value) {
  if (!value) return null
  return {
    ...value,
    sections: (value.sections || []).map(section => ({
      ...section,
      id: String(section.id),
      events: (section.events || []).map(event => ({
        ...event,
        ...normalizeEvent({
          ...event,
          id: String(event.id),
          dialogue: event.payload?.dialogue,
          combatants: event.payload?.combatants,
        }),
        id: String(event.id),
      })),
    })),
  }
}

function entryPayload(event) {
  return {
    type: event.type,
    title: event.title || '',
    desc: event.desc || '',
    payload: {
      dialogue: event.dialogue || [],
      combatants: event.combatants || [],
    },
  }
}

export function useJournalWorkspace({ characterUuid = '', sessionUuid = '' }) {
  const journal = ref(null)
  const sources = ref([])
  const canEdit = ref(false)
  const canManage = ref(false)
  const dragging = ref(false)
  const canSelectSource = ref(false)
  const loading = ref(true)
  const busy = ref(false)
  const error = ref('')
  let pollTimer = null
  let requestVersion = 0

  function apply(response) {
    journal.value = normalizedJournal(response?.journal)
    if (Array.isArray(response?.sources)) sources.value = response.sources
    if (typeof response?.canEdit === 'boolean') canEdit.value = response.canEdit
    if (typeof response?.canManage === 'boolean') canManage.value = response.canManage
    if (typeof response?.canSelectSource === 'boolean') canSelectSource.value = response.canSelectSource
    return journal.value
  }

  async function load({ quiet = false } = {}) {
    const version = ++requestVersion
    if (!quiet) loading.value = true
    try {
      const response = characterUuid
        ? await getCharacterJournal(characterUuid)
        : await getSessionJournal(sessionUuid)
      if (version !== requestVersion) return null
      // Empty source lists are omitted by the API, but must clear stale options.
      sources.value = response?.sources || []
      error.value = ''
      return apply(response)
    } catch (reason) {
      if (!quiet && version === requestVersion) error.value = reason?.message || 'Не удалось загрузить дневник'
      return null
    } finally {
      if (!quiet) loading.value = false
    }
  }

  async function refreshJournal() {
    if (busy.value || loading.value || dragging.value) return
    await load({ quiet: true })
  }

  async function mutate(request) {
    if (busy.value) return null
    requestVersion += 1
    busy.value = true
    error.value = ''
    try {
      return apply(await request())
    } catch (reason) {
      error.value = reason?.message || 'Не удалось сохранить дневник'
      throw reason
    } finally {
      busy.value = false
    }
  }

  async function createRoot(name) {
    const result = await mutate(() => characterUuid
      ? createCharacterJournal(characterUuid, name)
      : createSessionJournal(sessionUuid, name))
    if (characterUuid) await load({ quiet: true })
    return result
  }

  const selectSource = uuid => mutate(() => setCharacterJournal(characterUuid, uuid))
  const createSection = section => mutate(() => createJournalSection(journal.value.uuid, section))
  const updateSection = section => mutate(() => updateJournalSection(journal.value.uuid, section.id, section))
  const removeSection = sectionId => mutate(() => deleteJournalSection(journal.value.uuid, sectionId))
  const createEntry = (sectionId, event) => mutate(() => createJournalEntry(journal.value.uuid, sectionId, entryPayload(event)))
  const updateEntry = event => mutate(() => updateJournalEntry(journal.value.uuid, event.id, entryPayload(event)))
  const removeEntry = entryId => mutate(() => deleteJournalEntry(journal.value.uuid, entryId))
  const setPlayerEditing = enabled => mutate(() => setJournalPlayerEditing(journal.value.uuid, enabled))
  const reorderEntries = (sectionId, ids) => mutate(() => reorderJournalEntries(journal.value.uuid, sectionId, ids))
  function setDragging(value) { dragging.value = value; if (value) requestVersion += 1 }

  function onVisibilityChange() {
    if (document.visibilityState === 'visible') refreshJournal()
  }

  onMounted(() => {
    load()
    pollTimer = window.setInterval(refreshJournal, 12_000)
    document.addEventListener('visibilitychange', onVisibilityChange)
  })
  onBeforeUnmount(() => {
    requestVersion += 1
    window.clearInterval(pollTimer)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  })

  return {
    journal, sources, canEdit, canManage, canSelectSource, loading, busy, error,
    load, createRoot, selectSource, createSection, updateSection, removeSection,
    createEntry, updateEntry, removeEntry,
    setPlayerEditing, reorderEntries, setDragging,
  }
}
