import { computed, ref } from 'vue'
import {
  createArc as apiCreateArc,
  createChapter as apiCreateChapter,
  createChapterEdge as apiCreateEdge,
  deleteGraphNodes as apiDeleteGraphNodes,
  deleteArc as apiDeleteArc,
  deleteChapter as apiDeleteChapter,
  deleteChapterEdge as apiDeleteEdge,
  getChapterGraph,
  moveChapterPosition as apiMovePosition,
  moveChapterToArc as apiMoveToArc,
  moveGraphNodePositions as apiMovePositions,
  reorderArcs as apiReorderArcs,
  setCurrentChapter as apiSetCurrentChapter,
  updateArc as apiUpdateArc,
  updateChapter as apiUpdateChapter,
  updateChapterEdge as apiUpdateEdge,
  updateGraphNodeStatuses as apiUpdateGraphNodeStatuses,
} from '@/shared/api/sessionsApi'

export function useChapterGraph({ sessionUuid, session }) {
  const arcs = ref([])
  const chapters = ref([])
  const edges = ref([])
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref('')
  const selectedArcId = ref(readLastArc())

  const selectedArc = computed(() =>
    arcs.value.find(arc => arc.id === selectedArcId.value) ?? arcs.value[0] ?? null)
  const currentChapter = computed(() =>
    chapters.value.find(chapter => chapter.id === session.value?.currentChapterId) ?? null)
  const currentArc = computed(() =>
    currentChapter.value ? arcs.value.find(arc => arc.id === currentChapter.value.arcId) ?? null : null)
  const visibleChapters = computed(() =>
    chapters.value.filter(chapter => chapter.arcId === selectedArc.value?.id))
  const visibleEdges = computed(() =>
    edges.value.filter(edge => edge.arcId === selectedArc.value?.id))

  function storageKey() {
    return `chapter-graph:last-arc:${sessionUuid}`
  }

  function readLastArc() {
    try {
      const value = localStorage.getItem(`chapter-graph:last-arc:${sessionUuid}`)
      return value ? Number(value) : null
    } catch {
      return null
    }
  }

  function selectArc(id) {
    if (!arcs.value.some(arc => arc.id === id)) return
    selectedArcId.value = id
    try { localStorage.setItem(storageKey(), String(id)) } catch { /* ignore */ }
  }

  async function load() {
    if (loading.value) return
    loading.value = true
    error.value = ''
    try {
      const graph = await getChapterGraph(sessionUuid)
      arcs.value = graph?.arcs ?? []
      chapters.value = graph?.chapters ?? []
      edges.value = graph?.edges ?? []
      if (!arcs.value.some(arc => arc.id === selectedArcId.value)) {
        selectedArcId.value = currentArc.value?.id ?? arcs.value[0]?.id ?? null
      }
      loaded.value = true
    } catch {
      error.value = 'Не удалось загрузить карту глав'
    } finally {
      loading.value = false
    }
  }

  async function createArc(data) {
    const arc = await apiCreateArc(sessionUuid, data)
    arcs.value = [...arcs.value, arc]
    selectArc(arc.id)
    return arc
  }

  async function updateArc(arcId, data) {
    const updated = await apiUpdateArc(sessionUuid, arcId, data)
    arcs.value = arcs.value.map(arc => arc.id === arcId ? updated : arc)
    chapters.value = chapters.value.map(chapter => chapter.arcId === arcId
      ? { ...chapter, arcName: updated.name }
      : chapter)
    return updated
  }

  async function reorderArcs(ids) {
    await apiReorderArcs(sessionUuid, ids)
    const byId = new Map(arcs.value.map(arc => [arc.id, arc]))
    arcs.value = ids.map((id, index) => ({ ...byId.get(id), order: index + 1 }))
    const orders = new Map(arcs.value.map(arc => [arc.id, arc.order]))
    chapters.value = chapters.value.map(chapter => ({ ...chapter, arcOrder: orders.get(chapter.arcId) }))
  }

  async function deleteArc(arcId) {
    await apiDeleteArc(sessionUuid, arcId)
    arcs.value = arcs.value.filter(arc => arc.id !== arcId).map((arc, index) => ({ ...arc, order: index + 1 }))
    if (selectedArcId.value === arcId) selectArc(arcs.value[0]?.id ?? null)
  }

  async function createChapter(data) {
    const chapter = await apiCreateChapter(sessionUuid, data)
    chapters.value = [...chapters.value, chapter]
    return chapter
  }

  async function updateChapter(chapterId, data) {
    const updated = await apiUpdateChapter(sessionUuid, chapterId, data)
    chapters.value = chapters.value.map(chapter => chapter.id === chapterId ? updated : chapter)
    return updated
  }

  function setLocalPosition(chapterId, x, y) {
    chapters.value = chapters.value.map(chapter => chapter.id === chapterId
      ? { ...chapter, positionX: x, positionY: y }
      : chapter)
  }

  function setLocalPositions(positions) {
    const byId = new Map(positions.map(position => [String(position.id), position]))
    chapters.value = chapters.value.map(chapter => {
      const position = byId.get(String(chapter.id))
      return position ? { ...chapter, positionX: position.x, positionY: position.y } : chapter
    })
  }

  function setSceneCount(chapterId, count) {
    chapters.value = chapters.value.map(chapter => chapter.id === chapterId
      ? { ...chapter, sceneCount: count }
      : chapter)
  }

  async function savePosition(chapterId, x, y) {
    setLocalPosition(chapterId, x, y)
    await apiMovePosition(sessionUuid, chapterId, x, y)
  }

  async function savePositions(positions) {
    setLocalPositions(positions)
    await apiMovePositions(sessionUuid, 'chapters', positions)
  }

  async function moveChapterToArc(chapterId, arcId, x, y) {
    const updated = await apiMoveToArc(sessionUuid, chapterId, arcId, x, y)
    chapters.value = chapters.value.map(chapter => chapter.id === chapterId ? updated : chapter)
    edges.value = edges.value.filter(edge => edge.fromChapterId !== chapterId && edge.toChapterId !== chapterId)
    return updated
  }

  async function deleteChapter(chapterId) {
    await apiDeleteChapter(sessionUuid, chapterId)
    chapters.value = chapters.value.filter(chapter => chapter.id !== chapterId)
    edges.value = edges.value.filter(edge => edge.fromChapterId !== chapterId && edge.toChapterId !== chapterId)
    if (session.value?.currentChapterId === chapterId) {
      session.value = { ...session.value, currentChapterId: null }
    }
  }

  async function deleteChapters(ids) {
    await apiDeleteGraphNodes(sessionUuid, 'chapters', ids)
    const keys = new Set(ids.map(String))
    chapters.value = chapters.value.filter(chapter => !keys.has(String(chapter.id)))
    edges.value = edges.value.filter(edge =>
      !keys.has(String(edge.fromChapterId)) && !keys.has(String(edge.toChapterId)))
    if (keys.has(String(session.value?.currentChapterId))) {
      session.value = { ...session.value, currentChapterId: null }
    }
  }

  async function updateChapterStatuses(ids, status) {
    await apiUpdateGraphNodeStatuses(sessionUuid, 'chapters', ids, status)
    const keys = new Set(ids.map(String))
    chapters.value = chapters.value.map(chapter => keys.has(String(chapter.id))
      ? { ...chapter, status }
      : chapter)
  }

  async function makeCurrent(chapterId) {
    await apiSetCurrentChapter(sessionUuid, chapterId)
    session.value = { ...session.value, currentChapterId: chapterId }
    chapters.value = chapters.value.map(chapter => chapter.id === chapterId &&
      ['draft', 'planned', 'ready', 'available'].includes(chapter.status)
      ? { ...chapter, status: 'in_progress' }
      : chapter)
  }

  async function createEdge(data) {
    const edge = await apiCreateEdge(sessionUuid, data)
    edges.value = [...edges.value, edge]
    return edge
  }

  async function updateEdge(edgeId, data) {
    const updated = await apiUpdateEdge(sessionUuid, edgeId, data)
    edges.value = edges.value.map(edge => edge.id === edgeId ? updated : edge)
    return updated
  }

  async function deleteEdge(edgeId) {
    await apiDeleteEdge(sessionUuid, edgeId)
    edges.value = edges.value.filter(edge => edge.id !== edgeId)
  }

  function focusCurrent() {
    if (!currentChapter.value) return null
    selectArc(currentChapter.value.arcId)
    return currentChapter.value
  }

  return {
    arcs, chapters, edges, loading, loaded, error, selectedArcId,
    selectedArc, currentArc, currentChapter, visibleChapters, visibleEdges,
    load, selectArc, createArc, updateArc, reorderArcs, deleteArc,
    createChapter, updateChapter, setLocalPosition, setLocalPositions, setSceneCount, savePosition, savePositions, moveChapterToArc,
    deleteChapter, deleteChapters, updateChapterStatuses, makeCurrent, createEdge, updateEdge, deleteEdge, focusCurrent,
  }
}
