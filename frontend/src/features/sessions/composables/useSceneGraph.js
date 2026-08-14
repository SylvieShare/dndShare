import { ref } from 'vue'
import {
  createScene as apiCreateScene,
  createSceneEdge as apiCreateEdge,
  deleteScene as apiDeleteScene,
  deleteSceneEdge as apiDeleteEdge,
  getSceneGraph,
  moveScenePosition,
  renameScene as apiRenameScene,
} from '@/shared/api/scenesApi'

export function useSceneGraph({ sessionUuid, chapterId }) {
  const scenes = ref([])
  const edges = ref([])
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref('')

  async function load() {
    if (loading.value || chapterId == null) return
    loading.value = true
    error.value = ''
    try {
      const graph = await getSceneGraph(sessionUuid, chapterId)
      scenes.value = graph?.scenes ?? []
      edges.value = graph?.edges ?? []
      loaded.value = true
    } catch {
      error.value = 'Не удалось загрузить холст сценариев'
    } finally {
      loading.value = false
    }
  }

  async function createScene(name, position) {
    const scene = await apiCreateScene(sessionUuid, chapterId, name, position)
    scenes.value = [...scenes.value, scene]
    return scene
  }

  async function renameScene(sceneId, name) {
    const updated = await apiRenameScene(sessionUuid, sceneId, name)
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

  async function createEdge(fromSceneId, toSceneId) {
    const edge = await apiCreateEdge(sessionUuid, { chapterId, fromSceneId, toSceneId, label: null })
    edges.value = [...edges.value, edge]
    return edge
  }

  async function deleteEdge(edgeId) {
    await apiDeleteEdge(sessionUuid, edgeId)
    edges.value = edges.value.filter(edge => edge.id !== edgeId)
  }

  return {
    scenes, edges, loading, loaded, error,
    load, createScene, renameScene, deleteScene,
    setLocalPosition, savePosition, createEdge, deleteEdge,
  }
}
