import { ref, unref } from 'vue'
import {
  createScene as apiCreateScene,
  createSceneEdge as apiCreateEdge,
  deleteScene as apiDeleteScene,
  deleteSceneEdge as apiDeleteEdge,
  getSceneGraph,
  moveScenePosition,
  updateSceneEdge as apiUpdateEdge,
  updateScene as apiUpdateScene,
} from '@/shared/api/scenesApi'
import {
  deleteGraphNodes as apiDeleteGraphNodes,
  moveGraphNodePositions as apiMovePositions,
  updateGraphNodeStatuses as apiUpdateGraphNodeStatuses,
} from '@/shared/api/sessionsApi'

export function useSceneGraph({ sessionUuid, chapterId }) {
  const scenes = ref([])
  const edges = ref([])
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref('')
  let loadToken = 0

  function resolvedChapterId() {
    return unref(chapterId)
  }

  function reset() {
    loadToken += 1
    scenes.value = []
    edges.value = []
    loading.value = false
    loaded.value = false
    error.value = ''
  }

  async function load() {
    const activeChapterId = resolvedChapterId()
    if (loading.value || activeChapterId == null) return
    const token = ++loadToken
    loading.value = true
    error.value = ''
    try {
      const graph = await getSceneGraph(sessionUuid, activeChapterId)
      if (token !== loadToken) return
      scenes.value = graph?.scenes ?? []
      edges.value = graph?.edges ?? []
      loaded.value = true
    } catch {
      if (token !== loadToken) return
      error.value = 'Не удалось загрузить холст сценариев'
    } finally {
      if (token === loadToken) loading.value = false
    }
  }

  async function createScene(data, position) {
    const scene = await apiCreateScene(sessionUuid, resolvedChapterId(), data, position)
    scenes.value = [...scenes.value, scene]
    return scene
  }

  async function updateScene(sceneId, data) {
    const updated = await apiUpdateScene(sessionUuid, sceneId, data)
    scenes.value = scenes.value.map(scene => scene.id === sceneId ? updated : scene)
    return updated
  }

  async function deleteScene(sceneId) {
    await apiDeleteScene(sessionUuid, sceneId)
    scenes.value = scenes.value.filter(scene => scene.id !== sceneId)
    edges.value = edges.value.filter(edge => edge.fromSceneId !== sceneId && edge.toSceneId !== sceneId)
  }

  async function deleteScenes(ids) {
    await apiDeleteGraphNodes(sessionUuid, 'scenes', ids)
    const keys = new Set(ids.map(String))
    scenes.value = scenes.value.filter(scene => !keys.has(String(scene.id)))
    edges.value = edges.value.filter(edge =>
      !keys.has(String(edge.fromSceneId)) && !keys.has(String(edge.toSceneId)))
  }

  async function updateSceneStatuses(ids, status) {
    await apiUpdateGraphNodeStatuses(sessionUuid, 'scenes', ids, status)
    const keys = new Set(ids.map(String))
    scenes.value = scenes.value.map(scene => keys.has(String(scene.id)) ? { ...scene, status } : scene)
  }

  function setLocalPosition(sceneId, x, y) {
    scenes.value = scenes.value.map(scene => scene.id === sceneId
      ? { ...scene, positionX: x, positionY: y }
      : scene)
  }

  function setLocalPositions(positions) {
    const byId = new Map(positions.map(position => [String(position.id), position]))
    scenes.value = scenes.value.map(scene => {
      const position = byId.get(String(scene.id))
      return position ? { ...scene, positionX: position.x, positionY: position.y } : scene
    })
  }

  async function savePosition(sceneId, x, y) {
    setLocalPosition(sceneId, x, y)
    await moveScenePosition(sessionUuid, sceneId, x, y)
  }

  async function savePositions(positions) {
    setLocalPositions(positions)
    await apiMovePositions(sessionUuid, 'scenes', positions)
  }

  async function createEdge(fromSceneId, toSceneId, label = null) {
    const edge = await apiCreateEdge(sessionUuid, {
      chapterId: resolvedChapterId(), fromSceneId, toSceneId, label, bidirectional: false,
    })
    edges.value = [...edges.value, edge]
    return edge
  }

  async function updateEdge(edgeId, patch) {
    const current = edges.value.find(edge => edge.id === edgeId)
    if (!current) return null
    const updated = await apiUpdateEdge(sessionUuid, edgeId, {
      fromSceneId: current.fromSceneId,
      toSceneId: current.toSceneId,
      label: current.label ?? null,
      bidirectional: !!current.bidirectional,
      ...patch,
    })
    edges.value = edges.value.map(edge => edge.id === edgeId ? updated : edge)
    return updated
  }

  async function deleteEdge(edgeId) {
    await apiDeleteEdge(sessionUuid, edgeId)
    edges.value = edges.value.filter(edge => edge.id !== edgeId)
  }

  return {
    scenes, edges, loading, loaded, error,
    load, reset, createScene, updateScene, deleteScene, deleteScenes, updateSceneStatuses,
    setLocalPosition, setLocalPositions, savePosition, savePositions, createEdge, updateEdge, deleteEdge,
  }
}
