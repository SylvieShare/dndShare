import { fetchDelete, fetchGet, fetchPatch, fetchPost } from '@/shared/api/http'

export function createScene(uuid, chapterId, data, position = {}) {
  return fetchPost(`/sessions/${uuid}/chapters/${chapterId}/scenes`, {
    ...data,
    x: position.x ?? 0,
    y: position.y ?? 0,
  })
}

export function getSceneGraph(uuid, chapterId) {
  return fetchGet(`/sessions/${uuid}/chapters/${chapterId}/scene-graph`)
}

export function moveScenePosition(uuid, sceneId, x, y) {
  return fetchPatch(`/sessions/${uuid}/scenes/${sceneId}/position`, { x, y })
}

export function createSceneEdge(uuid, payload) {
  return fetchPost(`/sessions/${uuid}/scene-edges`, payload)
}

export function updateSceneEdge(uuid, edgeId, payload) {
  return fetchPatch(`/sessions/${uuid}/scene-edges/${edgeId}`, payload)
}

export function deleteSceneEdge(uuid, edgeId) {
  return fetchDelete(`/sessions/${uuid}/scene-edges/${edgeId}`)
}

export function updateScene(uuid, sceneId, data) {
  return fetchPatch(`/sessions/${uuid}/scenes/${sceneId}`, data)
}

export function deleteScene(uuid, sceneId) {
  return fetchDelete(`/sessions/${uuid}/scenes/${sceneId}`)
}

export function createSceneItem(uuid, sceneId, payload, position = {}) {
  return fetchPost(`/sessions/${uuid}/scenes/${sceneId}/items`, {
    ...payload,
    x: position.x ?? 0,
    y: position.y ?? 0,
  })
}

export function getSceneBlockGraph(uuid, sceneId) {
  return fetchGet(`/sessions/${uuid}/scenes/${sceneId}/block-graph`)
}

export function createSceneBlockEdge(uuid, payload) {
  return fetchPost(`/sessions/${uuid}/block-edges`, payload)
}

export function updateSceneBlockEdge(uuid, edgeId, payload) {
  return fetchPatch(`/sessions/${uuid}/block-edges/${edgeId}`, payload)
}

export function deleteSceneBlockEdge(uuid, edgeId) {
  return fetchDelete(`/sessions/${uuid}/block-edges/${edgeId}`)
}

export function updateSceneItem(uuid, sceneId, itemId, payload) {
  return fetchPatch(`/sessions/${uuid}/scenes/${sceneId}/items/${itemId}`, payload)
}

export function deleteSceneItem(uuid, sceneId, itemId) {
  return fetchDelete(`/sessions/${uuid}/scenes/${sceneId}/items/${itemId}`)
}
