import { ref, unref } from 'vue'
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
  let loadToken = 0

  function resolvedSceneId() {
    return unref(sceneId)
  }

  function reset() {
    loadToken += 1
    items.value = []
    edges.value = []
    loading.value = false
    loaded.value = false
    error.value = ''
  }

  async function load() {
    const activeSceneId = resolvedSceneId()
    if (loading.value || activeSceneId == null) return
    const token = ++loadToken
    loading.value = true
    error.value = ''
    try {
      const graph = await getSceneBlockGraph(sessionUuid, activeSceneId)
      if (token !== loadToken) return
      items.value = graph?.items ?? []
      edges.value = graph?.edges ?? []
      loaded.value = true
    } catch {
      if (token !== loadToken) return
      error.value = 'Не удалось загрузить холст блоков'
    } finally {
      if (token === loadToken) loading.value = false
    }
  }

  async function createItem(payload, position) {
    const item = await apiCreateItem(sessionUuid, resolvedSceneId(), payload, position)
    items.value = [...items.value, item]
    return item
  }

  async function updateItem(itemId, payload) {
    const updated = await apiUpdateItem(sessionUuid, resolvedSceneId(), itemId, {
      title: payload.title,
      data: payload.data,
      dataChanged: true,
    })
    items.value = items.value.map(item => item.id === itemId ? updated : item)
    return updated
  }

  async function deleteItem(itemId) {
    await apiDeleteItem(sessionUuid, resolvedSceneId(), itemId)
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
    const updated = await apiUpdateItem(sessionUuid, resolvedSceneId(), itemId, { positionX: x, positionY: y })
    items.value = items.value.map(item => item.id === itemId ? updated : item)
  }

  function setLocalWidth(itemId, width) {
    items.value = items.value.map(item => item.id === itemId
      ? { ...item, width }
      : item)
  }

  async function saveWidth(itemId, width) {
    setLocalWidth(itemId, width)
    const updated = await apiUpdateItem(sessionUuid, resolvedSceneId(), itemId, { width })
    items.value = items.value.map(item => item.id === itemId ? updated : item)
  }

  async function createEdge(fromItemId, toItemId) {
    const edge = await apiCreateEdge(sessionUuid, {
      sceneId: resolvedSceneId(), fromItemId, toItemId, label: null,
    })
    edges.value = [...edges.value, edge]
    return edge
  }

  async function deleteEdge(edgeId) {
    await apiDeleteEdge(sessionUuid, edgeId)
    edges.value = edges.value.filter(edge => edge.id !== edgeId)
  }

  return {
    items, edges, loading, loaded, error,
    load, reset, createItem, updateItem, deleteItem,
    setLocalPosition, savePosition, setLocalWidth, saveWidth, createEdge, deleteEdge,
  }
}
