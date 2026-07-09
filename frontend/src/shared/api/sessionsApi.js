import { fetchDelete, fetchGet, fetchPatch, fetchPost, fetchPut } from '@/shared/api/http'

export function pollChars(items) {
  return fetchPost('/chars/poll', items)
}

export function getSessions() {
  return fetchGet('/sessions')
}

export function getSession(uuid) {
  return fetchGet(`/sessions/${uuid}`)
}

export function createSession(data) {
  return fetchPost('/sessions', data)
}

export function deleteSession(id) {
  return fetchDelete(`/sessions/${id}`)
}

export function getSessionByCode(code) {
  return fetchGet(`/sessions/by-code/${encodeURIComponent(code)}`)
}

export function joinSession(uuid, charId) {
  return fetchPost(`/sessions/${uuid}/join`, { charId })
}

export function updateSessionStatus(uuid, status) {
  return fetchPatch(`/sessions/${uuid}/status`, { status })
}

export function leaveSession(uuid) {
  return fetchDelete(`/sessions/${uuid}/leave`)
}

export function updateSession(uuid, data) {
  return fetchPatch(`/sessions/${uuid}`, data)
}

export function kickParticipant(uuid, charId) {
  return fetchDelete(`/sessions/${uuid}/participants/${charId}`)
}

export function getEncounter(uuid) {
  return fetchGet(`/sessions/${uuid}/encounter`)
}

export function saveEncounter(uuid, data) {
  return fetchPut(`/sessions/${uuid}/encounter`, data)
}

export function getChapters(uuid) {
  return fetchGet(`/sessions/${uuid}/chapters`)
}

export function createChapter(uuid, name) {
  return fetchPost(`/sessions/${uuid}/chapters`, { name })
}

export function setCurrentChapter(uuid, chapterId) {
  return fetchPatch(`/sessions/${uuid}/current-chapter`, { chapterId })
}

export function renameChapter(uuid, chapterId, name) {
  return fetchPatch(`/sessions/${uuid}/chapters/${chapterId}`, { name })
}
