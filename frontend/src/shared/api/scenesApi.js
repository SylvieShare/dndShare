import { fetchDelete, fetchGet, fetchPatch, fetchPost } from '@/shared/api/http'

export function listScenes(uuid, chapterId) {
  return fetchGet(`/sessions/${uuid}/chapters/${chapterId}/scenes`)
}

export function createScene(uuid, chapterId, name) {
  return fetchPost(`/sessions/${uuid}/chapters/${chapterId}/scenes`, { name })
}

export function getScene(uuid, sceneId) {
  return fetchGet(`/sessions/${uuid}/scenes/${sceneId}`)
}

export function renameScene(uuid, sceneId, name) {
  return fetchPatch(`/sessions/${uuid}/scenes/${sceneId}`, { name })
}

export function deleteScene(uuid, sceneId) {
  return fetchDelete(`/sessions/${uuid}/scenes/${sceneId}`)
}

export function createSceneItem(uuid, sceneId, payload) {
  return fetchPost(`/sessions/${uuid}/scenes/${sceneId}/items`, payload)
}

export function updateSceneItem(uuid, sceneId, itemId, payload) {
  return fetchPatch(`/sessions/${uuid}/scenes/${sceneId}/items/${itemId}`, payload)
}

export function deleteSceneItem(uuid, sceneId, itemId) {
  return fetchDelete(`/sessions/${uuid}/scenes/${sceneId}/items/${itemId}`)
}

export function reorderSceneItems(uuid, sceneId, ids) {
  return fetchPatch(`/sessions/${uuid}/scenes/${sceneId}/items-order`, { ids })
}
