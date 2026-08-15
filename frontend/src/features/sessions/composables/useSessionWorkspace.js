import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { getSceneGraph } from '@/shared/api/scenesApi'

const WORKSPACE_MODES = new Set(['combat', 'scenes'])
const CONTENT_REVEAL_DELAY_MS = 210
const CLOSE_ANIMATION_MS = 190

export function sessionWorkspaceKey(sessionUuid) {
  return `session-workspace:v1:${sessionUuid}`
}

export function useSessionWorkspace({ sessionUuid, chapterGraph }) {
  const workspaceMode = ref(null)
  const workspaceChapterId = ref(null)
  const workspaceScene = ref(null)
  const workspaceClosing = ref(false)
  const workspaceRevealed = ref(false)
  const workspaceMotionActive = ref(false)
  let revealTimer = null
  let closeTimer = null

  const workspaceChapter = computed(() =>
    chapterGraph.chapters.value.find(chapter => chapter.id === workspaceChapterId.value) ?? null
  )
  const workspaceMotionMode = computed(() =>
    workspaceMotionActive.value ? workspaceMode.value : null
  )

  function saveWorkspace(mode, chapterId, sceneId = null) {
    try {
      localStorage.setItem(sessionWorkspaceKey(sessionUuid), JSON.stringify({
        mode,
        chapterId: chapterId ?? null,
        sceneId: sceneId ?? null,
      }))
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

  function cancelTimers() {
    if (revealTimer != null) clearTimeout(revealTimer)
    if (closeTimer != null) clearTimeout(closeTimer)
    revealTimer = null
    closeTimer = null
  }

  function revealWorkspace() {
    if (!workspaceMode.value || workspaceClosing.value || workspaceRevealed.value) return
    if (revealTimer != null) clearTimeout(revealTimer)
    const delay = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      ? 0
      : CONTENT_REVEAL_DELAY_MS
    revealTimer = setTimeout(() => {
      workspaceRevealed.value = true
      revealTimer = null
    }, delay)
  }

  function showWorkspace(mode, chapter, scene = null) {
    cancelTimers()
    workspaceChapterId.value = chapter?.id ?? null
    workspaceScene.value = mode === 'combat' ? scene : null
    workspaceMode.value = mode
    workspaceClosing.value = false
    workspaceRevealed.value = false
    workspaceMotionActive.value = true
    saveWorkspace(mode, chapter?.id, workspaceScene.value?.id)
    revealWorkspace()
  }

  async function openChapterScenes(chapter) {
    if (!chapterGraph.loaded.value) await chapterGraph.load()
    chapterGraph.selectArc(chapter.arcId)
    showWorkspace('scenes', chapter)
  }

  async function toggleCombatWorkspace(context = {}) {
    if (workspaceMode.value === 'combat' && !workspaceClosing.value) {
      closeWorkspace()
      return
    }
    if (!chapterGraph.loaded.value) await chapterGraph.load()
    const contextualChapter = chapterGraph.chapters.value.find(item => item.id === context.chapter?.id)
    const chapter = contextualChapter || chapterGraph.focusCurrent()
    if (contextualChapter) chapterGraph.selectArc(contextualChapter.arcId)
    await nextTick()
    await nextTick()
    showWorkspace('combat', chapter, contextualChapter ? context.scene : null)
  }

  async function restoreWorkspace() {
    const saved = readSavedWorkspace()
    if (!saved) return false
    if (!chapterGraph.loaded.value) await chapterGraph.load()

    if (saved.mode === 'combat') {
      const chapter = chapterGraph.chapters.value.find(item => item.id === saved.chapterId) || chapterGraph.focusCurrent()
      if (chapter) chapterGraph.selectArc(chapter.arcId)
      let scene = null
      if (chapter && saved.sceneId != null) {
        const graph = await getSceneGraph(sessionUuid, chapter.id).catch(() => null)
        const contextIndex = graph?.scenes?.findIndex(item => item.id === saved.sceneId) ?? -1
        const restoredScene = contextIndex >= 0 ? graph.scenes[contextIndex] : null
        scene = restoredScene ? { ...restoredScene, contextIndex } : null
      }
      showWorkspace('combat', chapter, scene)
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
    workspaceMotionActive.value = false
    if (revealTimer != null) clearTimeout(revealTimer)
    revealTimer = null
    const delay = workspaceRevealed.value ? CLOSE_ANIMATION_MS : 0
    closeTimer = setTimeout(() => {
      workspaceMode.value = null
      workspaceChapterId.value = null
      workspaceScene.value = null
      workspaceClosing.value = false
      workspaceRevealed.value = false
      workspaceMotionActive.value = false
      closeTimer = null
    }, delay)
  }

  onBeforeUnmount(cancelTimers)

  return {
    workspaceMode,
    workspaceChapter,
    workspaceScene,
    workspaceClosing,
    workspaceRevealed,
    workspaceMotionMode,
    openChapterScenes,
    toggleCombatWorkspace,
    restoreWorkspace,
    closeWorkspace,
  }
}
