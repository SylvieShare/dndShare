import { fetchDeleteJson, fetchGet, fetchPatch, fetchPost, fetchPut } from '@/shared/api/http'

export const getCharacterJournal = charUuid => fetchGet(`/char/${charUuid}/journal`, { cache: 'no-store' })
export const createCharacterJournal = (charUuid, name) => fetchPost(`/char/${charUuid}/journals`, { name })
export const setCharacterJournal = (charUuid, journalUuid) => fetchPut(`/char/${charUuid}/journal-source`, { journalUuid })

export const getSessionJournal = sessionUuid => fetchGet(`/sessions/${sessionUuid}/journal`, { cache: 'no-store' })
export const createSessionJournal = (sessionUuid, name) => fetchPost(`/sessions/${sessionUuid}/journal`, { name })
export const appendScenarioJournalItem = (sessionUuid, itemId) => (
  fetchPost(`/sessions/${sessionUuid}/journal/scenario-items/${itemId}`, {})
)

export const getJournal = journalUuid => fetchGet(`/journals/${journalUuid}`, { cache: 'no-store' })
export const createJournalSection = (journalUuid, data) => fetchPost(`/journals/${journalUuid}/sections`, data)
export const updateJournalSection = (journalUuid, sectionId, data) => fetchPatch(`/journals/${journalUuid}/sections/${sectionId}`, data)
export const deleteJournalSection = (journalUuid, sectionId) => fetchDeleteJson(`/journals/${journalUuid}/sections/${sectionId}`)
export const createJournalEntry = (journalUuid, sectionId, data) => fetchPost(`/journals/${journalUuid}/sections/${sectionId}/entries`, data)
export const updateJournalEntry = (journalUuid, entryId, data) => fetchPatch(`/journals/${journalUuid}/entries/${entryId}`, data)
export const deleteJournalEntry = (journalUuid, entryId) => fetchDeleteJson(`/journals/${journalUuid}/entries/${entryId}`)
