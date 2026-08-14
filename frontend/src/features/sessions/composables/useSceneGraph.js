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

  function setLocalPosition(sceneId, x, y) {
    scenes.value = scenes.value.map(scene => scene.id === sceneId
      ? { ...scene, positionX: x, positionY: y }
      : scene)
  }

  async function savePosition(sceneId, x, y) {
    setLocalPosition(sceneId, x, y)
    await moveScenePosition(sessionUuid, sceneId, x, y)
  }

  async function createEdge(fromSceneId, toSceneId, label = null) {
    const edge = await apiCreateEdge(sessionUuid, {
      chapterId: resolvedChapterId(), fromSceneId, toSceneId, label,
    })
    edges.value = [...edges.value, edge]
    return edge
  }

  async function updateEdge(edgeId, label) {
    const updated = await apiUpdateEdge(sessionUuid, edgeId, label)
    edges.value = edges.value.map(edge => edge.id === edgeId ? updated : edge)
    return updated
  }

  async function deleteEdge(edgeId) {
    await apiDeleteEdge(sessionUuid, edgeId)
    edges.value = edges.value.filter(edge => edge.id !== edgeId)
  }

  return {
    scenes, edges, loading, loaded, error,
    load, reset, createScene, updateScene, deleteScene,
    setLocalPosition, savePosition, createEdge, updateEdge, deleteEdge,
  }
}
