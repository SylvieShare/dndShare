import { ref } from 'vue'
import {
  createSceneBlockEdge as apiCreateEdge,
  createSceneItem as apiCreateItem,
  deleteSceneBlockEdge as apiDeleteEdge,
  deleteSceneItem as apiDeleteItem,
  getSceneBlockGraph,
  updateSceneItem as apiUpdateItem,
} from '@/shared/api/scenesApi'

export function useSceneBlockGraph({ sessionUuid, sceneId }) {
  const items = ref([])
  const edges = ref([])
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref('')

  async function load() {
    if (loading.value || sceneId == null) return
    loading.value = true
    error.value = ''
    try {
      const graph = await getSceneBlockGraph(sessionUuid, sceneId)
      items.value = graph?.items ?? []
      edges.value = graph?.edges ?? []
      loaded.value = true
    } catch {
      error.value = 'Не удалось загрузить холст блоков'
    } finally {
      loading.value = false
    }
  }

  async function createItem(payload, position) {
    const item = await apiCreateItem(sessionUuid, sceneId, payload, position)
    items.value = [...items.value, item]
    return item
  }

  async function updateItem(itemId, payload) {
    const updated = await apiUpdateItem(sessionUuid, sceneId, itemId, {
      title: payload.title,
      data: payload.data,
      dataChanged: true,
      color: payload.color,
      colorChanged: true,
    })
    items.value = items.value.map(item => item.id === itemId ? updated : item)
    return updated
  }

  async function deleteItem(itemId) {
    await apiDeleteItem(sessionUuid, sceneId, itemId)
    items.value = items.value.filter(item => item.id !== itemId)
    edges.value = edges.value.filter(edge => edge.fromItemId !== itemId && edge.toItemId !== itemId)
  }

  function setLocalPosition(itemId, x, y) {
    items.value = items.value.map(item => item.id === itemId
      ? { ...item, positionX: x, positionY: y }
      : item)
  }

  async function savePosition(itemId, x, y) {
    setLocalPosition(itemId, x, y)
    const updated = await apiUpdateItem(sessionUuid, sceneId, itemId, { positionX: x, positionY: y })
    items.value = items.value.map(item => item.id === itemId ? updated : item)
  }

  async function createEdge(fromItemId, toItemId) {
    const edge = await apiCreateEdge(sessionUuid, { sceneId, fromItemId, toItemId, label: null })
    edges.value = [...edges.value, edge]
    return edge
  }

  async function deleteEdge(edgeId) {
    await apiDeleteEdge(sessionUuid, edgeId)
    edges.value = edges.value.filter(edge => edge.id !== edgeId)
  }

  return {
    items, edges, loading, loaded, error,
    load, createItem, updateItem, deleteItem,
    setLocalPosition, savePosition, createEdge, deleteEdge,
  }
}
