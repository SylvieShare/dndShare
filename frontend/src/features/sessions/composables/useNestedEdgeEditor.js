import { ref } from 'vue'

export function useNestedEdgeEditor({ sceneGraph, blockGraph, saving, actionError }) {
  const editorOpen = ref(false)
  const editingEdge = ref(null)
  const level = ref(null)

  async function createEdge(nextLevel, from, to) {
    const graph = nextLevel === 'scenes' ? sceneGraph : blockGraph
    saving.value = true
    actionError.value = ''
    try {
      await graph.createEdge(from.id, to.id, null)
    } catch {
      actionError.value = 'Не удалось создать переход — возможно, он уже существует'
    } finally {
      saving.value = false
    }
  }

  function beginEdit(nextLevel, edge) {
    editingEdge.value = edge
    level.value = nextLevel
    editorOpen.value = true
  }

  function closeEditor() {
    editorOpen.value = false
    editingEdge.value = null
    level.value = null
  }

  async function saveEdge(label) {
    const activeLevel = level.value
    const graph = activeLevel === 'scenes' ? sceneGraph : blockGraph
    const edge = editingEdge.value
    if (!activeLevel || !edge) return
    saving.value = true
    actionError.value = ''
    try {
      await graph.updateEdge(edge.id, { label })
      closeEditor()
    } catch {
      actionError.value = 'Не удалось сохранить подпись перехода'
    } finally {
      saving.value = false
    }
  }

  return {
    editorOpen,
    editingEdge,
    createEdge,
    beginEdit,
    closeEditor,
    saveEdge,
  }
}
