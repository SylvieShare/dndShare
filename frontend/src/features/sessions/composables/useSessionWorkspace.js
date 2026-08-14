import { computed, nextTick, onBeforeUnmount, ref } from 'vue'

const WORKSPACE_MODES = new Set(['combat', 'scenes'])
const CLOSE_ANIMATION_MS = 190

export function sessionWorkspaceKey(sessionUuid) {
  return `session-workspace:v1:${sessionUuid}`
}

export function useSessionWorkspace({ sessionUuid, chapterGraph }) {
  const workspaceMode = ref(null)
  const workspaceChapterId = ref(null)
  const workspaceClosing = ref(false)
  let closeTimer = null

  const workspaceChapter = computed(() =>
    chapterGraph.chapters.value.find(chapter => chapter.id === workspaceChapterId.value) ?? null
  )
  const workspaceArcs = computed(() =>
    chapterGraph.arcs.value.filter(arc => arc.id === workspaceChapter.value?.arcId)
  )

  function saveWorkspace(mode, chapterId) {
    try {
      localStorage.setItem(sessionWorkspaceKey(sessionUuid), JSON.stringify({ mode, chapterId: chapterId ?? null }))
    } catch { /* ignore unavailable storage */ }
  }

  function clearSavedWorkspace() {
    try { localStorage.removeItem(sessionWorkspaceKey(sessionUuid)) } catch { /* ignore */ }
  }

  function readSavedWorkspace() {
    try {
      const saved = JSON.parse(localStorage.getItem(sessionWorkspaceKey(sessionUuid)) || 'null')
      return saved && WORKSPACE_MODES.has(saved.mode) ? saved : null
    } catch {
      return null
    }
  }

  function cancelClose() {
    if (closeTimer != null) clearTimeout(closeTimer)
    closeTimer = null
  }

  function showWorkspace(mode, chapter) {
    cancelClose()
    workspaceChapterId.value = chapter?.id ?? null
    workspaceMode.value = mode
    workspaceClosing.value = false
    saveWorkspace(mode, chapter?.id)
  }

  async function openChapterScenes(chapter) {
    if (!chapterGraph.loaded.value) await chapterGraph.load()
    chapterGraph.selectArc(chapter.arcId)
    showWorkspace('scenes', chapter)
  }

  async function toggleCombatWorkspace() {
    if (workspaceMode.value === 'combat' && !workspaceClosing.value) {
      closeWorkspace()
      return
    }
    if (!chapterGraph.loaded.value) await chapterGraph.load()
    const chapter = chapterGraph.focusCurrent()
    await nextTick()
    await nextTick()
    showWorkspace('combat', chapter)
  }

  async function restoreWorkspace() {
    const saved = readSavedWorkspace()
    if (!saved) return false
    if (!chapterGraph.loaded.value) await chapterGraph.load()

    if (saved.mode === 'combat') {
      const chapter = chapterGraph.focusCurrent()
      showWorkspace('combat', chapter)
      return true
    }

    const chapter = chapterGraph.chapters.value.find(item => item.id === saved.chapterId)
    if (!chapter) {
      clearSavedWorkspace()
      return false
    }
    chapterGraph.selectArc(chapter.arcId)
    showWorkspace('scenes', chapter)
    return true
  }

  function closeWorkspace() {
    if (!workspaceMode.value || workspaceClosing.value) return
    clearSavedWorkspace()
    workspaceClosing.value = true
    cancelClose()
    closeTimer = setTimeout(() => {
      workspaceMode.value = null
      workspaceChapterId.value = null
      workspaceClosing.value = false
      closeTimer = null
    }, CLOSE_ANIMATION_MS)
  }

  onBeforeUnmount(cancelClose)

  return {
    workspaceMode,
    workspaceChapter,
    workspaceArcs,
    workspaceClosing,
    openChapterScenes,
    toggleCombatWorkspace,
    restoreWorkspace,
    closeWorkspace,
  }
}
