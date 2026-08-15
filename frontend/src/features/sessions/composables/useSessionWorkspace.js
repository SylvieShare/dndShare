import { computed, nextTick, onBeforeUnmount, reactive } from 'vue'
import { getSceneGraph } from '@/shared/api/scenesApi'

const WORKSPACE_MODES = new Set(['combat', 'scenes'])
const WORKSPACE_LEVELS = new Set(['chapters', 'scenes', 'blocks'])
const CONTENT_REVEAL_DELAY_MS = 210
const CLOSE_ANIMATION_MS = 190

export function sessionWorkspaceKey(sessionUuid) {
  return `session-workspace:v1:${sessionUuid}`
}

export function useSessionWorkspace({ sessionUuid, chapterGraph }) {
  const state = reactive({
    mode: null,
    chapterId: null,
    scene: null,
    level: 'chapters',
    phase: 'idle',
  })
  let revealTimer = null
  let closeTimer = null

  const workspaceMode = computed(() => state.mode)
  const workspaceChapterId = computed(() => state.chapterId)
  const workspaceScene = computed(() => state.scene)
  const workspaceLevel = computed(() => state.level)
  const workspaceClosing = computed(() => state.phase === 'closing')
  const workspaceRevealed = computed(() => state.phase === 'open')
  const workspaceChapter = computed(() =>
    chapterGraph.chapters.value.find(chapter => chapter.id === state.chapterId) ?? null
  )
  const workspaceMotionMode = computed(() =>
    ['opening', 'open'].includes(state.phase) ? state.mode : null
  )

  function saveWorkspace(mode, chapterId, sceneId = null, level = 'chapters') {
    try {
      localStorage.setItem(sessionWorkspaceKey(sessionUuid), JSON.stringify({
        mode,
        chapterId: chapterId ?? null,
        sceneId: sceneId ?? null,
        level,
      }))
    } catch { /* ignore unavailable storage */ }
  }

  function clearSavedWorkspace() {
    try { localStorage.removeItem(sessionWorkspaceKey(sessionUuid)) } catch { /* ignore */ }
  }

  function readSavedWorkspace() {
    try {
      const saved = JSON.parse(localStorage.getItem(sessionWorkspaceKey(sessionUuid)) || 'null')
      if (!saved || !WORKSPACE_MODES.has(saved.mode)) return null
      return {
        ...saved,
        level: WORKSPACE_LEVELS.has(saved.level) ? saved.level : 'chapters',
      }
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
    if (!state.mode || state.phase !== 'opening') return
    if (revealTimer != null) clearTimeout(revealTimer)
    const delay = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      ? 0
      : CONTENT_REVEAL_DELAY_MS
    revealTimer = setTimeout(() => {
      if (state.phase === 'opening') state.phase = 'open'
      revealTimer = null
    }, delay)
  }

  function showWorkspace(mode, chapter, scene = null, level = mode === 'scenes' ? 'scenes' : 'chapters') {
    cancelTimers()
    Object.assign(state, {
      mode,
      chapterId: chapter?.id ?? null,
      scene,
      level: WORKSPACE_LEVELS.has(level) ? level : 'chapters',
      phase: 'opening',
    })
    saveWorkspace(mode, state.chapterId, state.scene?.id, state.level)
    revealWorkspace()
  }

  async function openChapterScenes(chapter) {
    if (!chapterGraph.loaded.value) await chapterGraph.load()
    chapterGraph.selectArc(chapter.arcId)
    showWorkspace('scenes', chapter, null, 'scenes')
  }

  async function toggleCombatWorkspace(context = {}) {
    if (state.mode === 'combat' && state.phase !== 'closing') {
      closeWorkspace()
      return
    }
    if (!chapterGraph.loaded.value) await chapterGraph.load()
    const contextualChapter = chapterGraph.chapters.value.find(item => item.id === context.chapter?.id)
    const chapter = contextualChapter || chapterGraph.focusCurrent()
    if (contextualChapter) chapterGraph.selectArc(contextualChapter.arcId)
    await nextTick()
    await nextTick()
    const scene = contextualChapter ? context.scene : null
    const level = scene && context.level === 'blocks' ? 'blocks' : contextualChapter ? 'scenes' : 'chapters'
    showWorkspace('combat', chapter, scene, level)
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
      showWorkspace('combat', chapter, scene, saved.level || (scene ? 'blocks' : 'chapters'))
      return true
    }

    const chapter = chapterGraph.chapters.value.find(item => item.id === saved.chapterId)
    if (!chapter) {
      clearSavedWorkspace()
      return false
    }
    chapterGraph.selectArc(chapter.arcId)
    let scene = null
    if (saved.sceneId != null) {
      const graph = await getSceneGraph(sessionUuid, chapter.id).catch(() => null)
      const contextIndex = graph?.scenes?.findIndex(item => item.id === saved.sceneId) ?? -1
      const restoredScene = contextIndex >= 0 ? graph.scenes[contextIndex] : null
      scene = restoredScene ? { ...restoredScene, contextIndex } : null
    }
    showWorkspace('scenes', chapter, scene, saved.level === 'blocks' && scene ? 'blocks' : 'scenes')
    return true
  }

  function updateWorkspaceContext({ level, scene } = {}) {
    if (state.mode !== 'scenes') return
    state.level = level === 'blocks' ? 'blocks' : 'scenes'
    state.scene = scene ?? null
    saveWorkspace('scenes', state.chapterId, state.scene?.id, state.level)
  }

  function closeWorkspace() {
    if (!state.mode || state.phase === 'closing') return
    const returnToNested = state.mode === 'combat'
      && ['scenes', 'blocks'].includes(state.level)
      && state.chapterId != null
    if (returnToNested) saveWorkspace('scenes', state.chapterId, state.scene?.id, state.level)
    else clearSavedWorkspace()
    const wasRevealed = state.phase === 'open'
    state.phase = 'closing'
    if (revealTimer != null) clearTimeout(revealTimer)
    revealTimer = null
    const delay = wasRevealed ? CLOSE_ANIMATION_MS : 0
    closeTimer = setTimeout(() => {
      if (returnToNested) {
        state.mode = 'scenes'
        state.phase = 'opening'
        revealWorkspace()
        closeTimer = null
        return
      }
      Object.assign(state, {
        mode: null,
        chapterId: null,
        scene: null,
        level: 'chapters',
        phase: 'idle',
      })
      closeTimer = null
    }, delay)
  }

  onBeforeUnmount(cancelTimers)

  return {
    workspaceMode,
    workspaceChapter,
    workspaceScene,
    workspaceLevel,
    workspaceClosing,
    workspaceRevealed,
    workspaceMotionMode,
    openChapterScenes,
    toggleCombatWorkspace,
    restoreWorkspace,
    updateWorkspaceContext,
    closeWorkspace,
  }
}
