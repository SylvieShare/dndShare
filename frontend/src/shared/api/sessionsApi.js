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

export function updateParticipantColor(uuid, charId, color) {
  return fetchPatch(`/sessions/${uuid}/participants/${charId}/color`, { color })
}

export function reorderParticipants(uuid, ids) {
  return fetchPatch(`/sessions/${uuid}/participants-order`, { ids })
}

export function getEncounter(uuid) {
  return fetchGet(`/sessions/${uuid}/encounter`)
}

export function saveEncounter(uuid, data) {
  return fetchPut(`/sessions/${uuid}/encounter`, data)
}

export function getPublicEncounter(uuid) {
  return fetchGet(`/public/sessions/${uuid}/encounter`)
}

export function getChapters(uuid) {
  return fetchGet(`/sessions/${uuid}/chapters`)
}

export function getChapterGraph(uuid) {
  return fetchGet(`/sessions/${uuid}/chapter-graph`)
}

export function createArc(uuid, data) {
  return fetchPost(`/sessions/${uuid}/arcs`, data)
}

export function updateArc(uuid, arcId, data) {
  return fetchPatch(`/sessions/${uuid}/arcs/${arcId}`, data)
}

export function reorderArcs(uuid, ids) {
  return fetchPatch(`/sessions/${uuid}/arcs-order`, { ids })
}

export function deleteArc(uuid, arcId) {
  return fetchDelete(`/sessions/${uuid}/arcs/${arcId}`)
}

export function createChapter(uuid, data) {
  return fetchPost(`/sessions/${uuid}/chapters`, data)
}

export function setCurrentChapter(uuid, chapterId) {
  return fetchPatch(`/sessions/${uuid}/current-chapter`, { chapterId })
}

export function updateChapter(uuid, chapterId, data) {
  return fetchPatch(`/sessions/${uuid}/chapters/${chapterId}`, data)
}

export function moveChapterPosition(uuid, chapterId, x, y) {
  return fetchPatch(`/sessions/${uuid}/chapters/${chapterId}/position`, { x, y })
}

export function moveGraphNodePositions(uuid, level, positions) {
  return fetchPatch(`/sessions/${uuid}/graph-nodes/positions`, { level, positions })
}

export function deleteGraphNodes(uuid, level, ids) {
  return fetchPost(`/sessions/${uuid}/graph-nodes/delete`, { level, ids })
}

export function updateGraphNodeStatuses(uuid, level, ids, status) {
  return fetchPatch(`/sessions/${uuid}/graph-nodes/status`, { level, ids, status })
}

export function moveChapterToArc(uuid, chapterId, arcId, x, y) {
  return fetchPatch(`/sessions/${uuid}/chapters/${chapterId}/arc`, { arcId, x, y })
}

export function deleteChapter(uuid, chapterId) {
  return fetchDelete(`/sessions/${uuid}/chapters/${chapterId}`)
}

export function createChapterEdge(uuid, data) {
  return fetchPost(`/sessions/${uuid}/chapter-edges`, data)
}

export function updateChapterEdge(uuid, edgeId, data) {
  return fetchPatch(`/sessions/${uuid}/chapter-edges/${edgeId}`, data)
}

export function deleteChapterEdge(uuid, edgeId) {
  return fetchDelete(`/sessions/${uuid}/chapter-edges/${edgeId}`)
}
