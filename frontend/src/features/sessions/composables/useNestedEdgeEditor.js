import { computed, ref } from 'vue'

export function useNestedEdgeEditor({ sceneGraph, blockGraph, saving, actionError }) {
  const editorOpen = ref(false)
  const editingEdge = ref(null)
  const pendingEdge = ref(null)
  const level = ref(null)

  const editorTitle = computed(() => {
    if (editingEdge.value) return 'Изменить переход'
    const pending = pendingEdge.value
    if (!pending) return 'Новый переход'
    const from = pending.from.name || pending.from.title || 'Карточка'
    const to = pending.to.name || pending.to.title || 'Карточка'
    return `${from} → ${to}`
  })

  function beginCreate(nextLevel, from, to) {
    editingEdge.value = null
    pendingEdge.value = { from, to }
    level.value = nextLevel
    editorOpen.value = true
  }

  function beginEdit(nextLevel, edge) {
    editingEdge.value = edge
    pendingEdge.value = null
    level.value = nextLevel
    editorOpen.value = true
  }

  function closeEditor() {
    editorOpen.value = false
    editingEdge.value = null
    pendingEdge.value = null
    level.value = null
  }

  async function saveEdge(label) {
    const activeLevel = level.value
    const graph = activeLevel === 'scenes' ? sceneGraph : blockGraph
    const edge = editingEdge.value
    const pending = pendingEdge.value
    if (!activeLevel || (!edge && !pending)) return
    saving.value = true
    actionError.value = ''
    try {
      if (edge) await graph.updateEdge(edge.id, label)
      else await graph.createEdge(pending.from.id, pending.to.id, label)
      closeEditor()
    } catch {
      actionError.value = edge
        ? 'Не удалось сохранить подпись перехода'
        : 'Не удалось создать переход — возможно, он уже существует'
    } finally {
      saving.value = false
    }
  }

  return {
    editorOpen,
    editingEdge,
    editorTitle,
    beginCreate,
    beginEdit,
    closeEditor,
    saveEdge,
  }
}
