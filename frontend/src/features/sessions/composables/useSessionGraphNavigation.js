import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useItemReferenceMap } from '@/features/sessions/composables/useItemReferenceMap'
import { useSceneBlockGraph } from '@/features/sessions/composables/useSceneBlockGraph'
import { useSceneGraph } from '@/features/sessions/composables/useSceneGraph'

export function useSessionGraphNavigation({ props, emit, canvas }) {
  const displayLevel = ref('chapters')
  const selectedSceneId = ref(null)
  const transitionSpotlight = ref(null)
  let transitionTimer = null
  let rememberedChapterId = null
  let contextSyncSuspended = false

  const activeChapterId = computed(() => props.workspaceChapterId ?? rememberedChapterId)
  const activeChapter = computed(() =>
    props.graph.chapters.value.find(chapter => chapter.id === activeChapterId.value) ?? null
  )
  const activeSceneId = computed(() => selectedSceneId.value)
  const sceneGraph = useSceneGraph({ sessionUuid: props.sessionUuid, chapterId: activeChapterId })
  const blockGraph = useSceneBlockGraph({ sessionUuid: props.sessionUuid, sceneId: activeSceneId })
  const selectedScene = computed(() => {
    const sceneId = selectedSceneId.value
    if (sceneId == null) return null
    return sceneGraph.scenes.value.find(scene => String(scene.id) === String(sceneId))
      ?? (String(props.workspaceScene?.id) === String(sceneId) ? props.workspaceScene : null)
  })
  const blockItemIds = computed(() => blockGraph.items.value.flatMap(block => [
    ...(block.type === 'combat' ? (block.data?.creatures || [])
      .filter(creature => creature?.kind === 'handbook')
      .map(creature => creature.itemId) : []),
    ...(block.type === 'reward' ? (block.data?.items || []).map(item => item?.itemId) : []),
  ]))
  const { itemsById: blockItemsById } = useItemReferenceMap(blockItemIds)

  function transitionDelay() {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 420
  }

  function graphKeyFor(level) {
    if (level === 'chapters') return `chapters:${props.sessionUuid}:${props.graph.selectedArc.value?.id ?? 'none'}`
    if (level === 'scenes') return `scenes:${props.sessionUuid}:${activeChapterId.value ?? 'none'}`
    return `blocks:${props.sessionUuid}:${activeSceneId.value ?? 'none'}`
  }

  function activateLevel(level) {
    canvas.value?.prepareView(graphKeyFor(level), level === 'chapters' ? 80 : 210)
    displayLevel.value = level
  }

  function scheduleTransition(callback) {
    if (transitionTimer != null) clearTimeout(transitionTimer)
    transitionTimer = setTimeout(() => {
      transitionTimer = null
      callback()
    }, transitionDelay())
  }

  async function openScenesLevel(chapterId) {
    contextSyncSuspended = true
    const restoredScene = props.workspaceScene
    const restoredLevel = props.workspaceLevel
    rememberedChapterId = chapterId
    selectedSceneId.value = null
    sceneGraph.reset()
    blockGraph.reset()
    sceneGraph.load().then(() => {
      if (sceneGraph.loaded.value) emit('scene-count', chapterId, sceneGraph.scenes.value.length)
    })
    transitionSpotlight.value = { level: 'chapters', id: chapterId, offset: 0 }
    scheduleTransition(() => {
      transitionSpotlight.value = null
      selectedSceneId.value = restoredScene?.id ?? null
      if (restoredLevel === 'blocks' && restoredScene) {
        blockGraph.reset()
        blockGraph.load()
        activateLevel('blocks')
      } else activateLevel('scenes')
      nextTick(() => {
        contextSyncSuspended = false
        notifyWorkspaceContext()
      })
    })
  }

  function openBlocksLevel(scene) {
    if (displayLevel.value !== 'scenes') return
    selectedSceneId.value = scene.id
    blockGraph.reset()
    blockGraph.load()
    transitionSpotlight.value = { level: 'scenes', id: scene.id, offset: 252 }
    scheduleTransition(() => {
      transitionSpotlight.value = null
      activateLevel('blocks')
    })
  }

  async function animateBack(level, nodeId, offset) {
    if (transitionTimer != null) clearTimeout(transitionTimer)
    transitionSpotlight.value = { level, id: nodeId, offset }
    activateLevel(level)
    await nextTick()
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { transitionSpotlight.value = null })
    })
  }

  function returnToScenes() {
    if (!selectedScene.value || props.workspaceMode === 'combat') return
    animateBack('scenes', selectedScene.value.id, 252)
  }

  function returnToChapters() {
    emit('close-workspace')
  }

  function sceneIndex(scene) {
    return sceneGraph.scenes.value.findIndex(item => item.id === scene.id)
  }

  function combatSceneContext() {
    if (!selectedScene.value) return null
    return { ...selectedScene.value, contextIndex: sceneIndex(selectedScene.value) }
  }

  function notifyWorkspaceContext() {
    if (contextSyncSuspended || props.workspaceMode !== 'scenes') return
    emit('workspace-context-change', {
      level: displayLevel.value,
      scene: selectedScene.value ? combatSceneContext() : null,
    })
  }

  watch(() => props.workspaceMode, (mode, previousMode) => {
    if (mode === 'scenes' && props.workspaceChapterId != null) {
      const preservedNestedContext = previousMode === 'combat'
        && rememberedChapterId === props.workspaceChapterId
        && displayLevel.value === props.workspaceLevel
        && (props.workspaceLevel !== 'blocks'
          || String(selectedSceneId.value) === String(props.workspaceScene?.id))
      if (preservedNestedContext) {
        selectedSceneId.value = props.workspaceScene?.id ?? null
        nextTick(notifyWorkspaceContext)
      } else if (previousMode !== 'scenes' || rememberedChapterId !== props.workspaceChapterId) {
        openScenesLevel(props.workspaceChapterId)
      }
      return
    }
    if (mode === 'combat') {
      rememberedChapterId = props.workspaceChapterId
      selectedSceneId.value = props.workspaceScene?.id ?? null
      if (previousMode !== 'scenes') displayLevel.value = 'chapters'
      return
    }
    if (previousMode === 'scenes') {
      const chapterId = rememberedChapterId
      animateBack('chapters', chapterId, 0)
      scheduleTransition(() => {
        sceneGraph.reset()
        blockGraph.reset()
        selectedSceneId.value = null
        rememberedChapterId = null
      })
    }
  }, { immediate: true })

  watch(() => props.workspaceChapterId, chapterId => {
    if (props.workspaceMode === 'scenes' && chapterId != null && chapterId !== rememberedChapterId) openScenesLevel(chapterId)
  })
  watch(() => props.workspaceScene, scene => {
    if (props.workspaceMode === 'combat') selectedSceneId.value = scene?.id ?? null
  })
  watch([displayLevel, selectedSceneId], notifyWorkspaceContext, { flush: 'post' })
  onBeforeUnmount(() => { if (transitionTimer != null) clearTimeout(transitionTimer) })

  return {
    displayLevel,
    selectedScene,
    transitionSpotlight,
    activeChapterId,
    activeChapter,
    sceneGraph,
    blockGraph,
    blockItemsById,
    graphKeyFor,
    openBlocksLevel,
    returnToScenes,
    returnToChapters,
    sceneIndex,
    combatSceneContext,
  }
}
