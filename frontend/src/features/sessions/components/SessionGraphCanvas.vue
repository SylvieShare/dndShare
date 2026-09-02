<template>
  <section class="session-graph-canvas" :data-level="displayLevel">
    <NestedGraphCanvas
      ref="canvas"
      class="session-graph-canvas__nested"
      :class="{ 'session-graph-canvas__nested--combat-hidden': workspaceMode === 'combat' }"
      :graph-key="activeGraphKey"
      :nodes="activeNodes"
      :edges="activeEdges"
      :from-key="activeFromKey"
      :to-key="activeToKey"
      :node-width="activeNodeWidth"
      :node-height="activeNodeHeight"
      :node-width-key="displayLevel === 'blocks' ? 'width' : ''"
      :dynamic-node-height="displayLevel === 'blocks'"
      :resizable-nodes="displayLevel === 'blocks'"
      :linking-from="activeLinkingFrom"
      :locked="workspaceMode === 'combat'"
      :loading="activeLoading"
      :can-edit="isDm && workspaceMode !== 'combat'"
      :spotlight-node-id="activeSpotlightId"
      :spotlight-offset-x="spotlightOffsetX"
      :initial-top="activeInitialTop"
      :empty-title="emptyCopy.title"
      :empty-description="emptyCopy.description"
      :show-empty-action="false"
      :layout-key="workspaceLayoutMode"
      :status-options="displayLevel === 'chapters' ? CHAPTER_STATUSES : displayLevel === 'scenes' ? SCENE_STATUSES : []"
      @node-click="handleNodeClick"
      @node-double-click="handleNodeDoubleClick"
      @edge-click="handleEdgeClick"
      @start-link="startLink"
      @finish-link="finishLink"
      @rewire-edge="rewireEdge"
      @preview-positions="previewPositions"
      @save-positions="savePositions"
      @preview-size="previewSize"
      @save-size="saveSize"
      @selection-change="handleSelectionChange"
      @drag-start="handleDragStart"
      @delete-selection="requestSelectionDelete"
      @change-selection-status="changeSelectionStatus"
    >
      <template #node="{ node, linking, target, spotlight }">
        <ChapterGraphNode
          v-if="displayLevel === 'chapters'"
          embedded
          :show-link-port="false"
          :chapter="node"
          :current="node.id === currentChapterId"
          :linking="linking"
          :target="target"
          :spotlight="spotlight"
        />
        <SceneGraphNode
          v-else-if="displayLevel === 'scenes'"
          :scene="node"
          :index="sceneIndex(node)"
          :spotlight="spotlight"
        />
        <SceneBlockNode
          v-else
          :block="node"
          :items-by-id="blockItemsById"
        />
      </template>
    </NestedGraphCanvas>

    <button
      v-if="showChapterAncestor && workspaceMode !== 'combat'"
      class="session-graph-back"
      type="button"
      @pointerdown.stop
      @click.stop="navigateBack"
    >
      <ArrowLeft :size="15" aria-hidden="true" />
      {{ backLabel }}
    </button>

    <div
      v-if="showChapterAncestor && workspaceMode !== 'combat'"
      class="session-graph-ancestor session-graph-ancestor--chapter"
      title="Действия с главой"
      :role="isDm ? 'button' : undefined"
      :tabindex="isDm ? 0 : -1"
      :aria-label="activeChapter ? `Действия с главой ${activeChapter.number}` : 'Действия с главой'"
      @click.stop="openChapterAncestorMenu"
      @dblclick.stop="returnToChapters"
      @keydown.enter.stop.prevent="openChapterAncestorMenu"
      @keydown.space.stop.prevent="openChapterAncestorMenu"
    >
      <ChapterGraphNode
        v-if="activeChapter"
        embedded
        :show-link-port="false"
        :chapter="activeChapter"
        :current="activeChapter.id === currentChapterId"
        spotlight
      />
    </div>
    <div
      v-if="displayLevel === 'blocks' && workspaceMode !== 'combat' && selectedScene"
      class="session-graph-ancestor session-graph-ancestor--scene"
      title="Действия со сценарием"
      :role="isDm ? 'button' : undefined"
      :tabindex="isDm ? 0 : -1"
      @click.stop="openSceneAncestorMenu"
      @dblclick.stop="returnFromSceneAncestor"
      @keydown.enter.stop.prevent="openSceneAncestorMenu"
      @keydown.space.stop.prevent="openSceneAncestorMenu"
    >
      <SceneGraphNode
        :scene="selectedScene"
        :index="selectedScene.contextIndex ?? sceneIndex(selectedScene)"
        spotlight
      />
    </div>

    <CanvasActionDock
      v-if="isDm && workspaceMode !== 'combat'"
      :actions="canvasActions"
      @action="runCanvasAction"
    />

    <CanvasHotkeyHints v-if="isDm && workspaceMode !== 'combat' && showHotkeyLegend" />

    <SceneBlockMenus
      ref="blockMenus"
      @edit="openBlockEdit"
      @copy="copyBlock"
      @delete="requestBlockDelete"
      @send-to-combat="sendBlockToCombat"
      @broadcast="broadcastBlock"
    />

    <SceneGraphMenus
      ref="sceneMenus"
      @open-scene="openBlocksLevel"
      @status="changeSceneStatus"
      @edit="openSceneRename"
      @delete="requestSceneDelete"
      @return-scenes="returnFromSceneMenu"
    />

    <NestedEdgeMenus
      ref="edgeMenus"
      @edit="openNestedEdgeEdit"
      @toggle-direction="toggleNestedEdgeDirection"
      @reverse="reverseNestedEdge"
      @delete="requestNestedEdgeDelete"
    />

    <div v-if="activeLoading" class="session-graph-state">{{ loadingLabel }}</div>
    <div v-if="activeError || actionError" class="session-graph-error" role="alert">{{ actionError || activeError }}</div>

    <SceneEditorModal
      v-if="scenePromptOpen"
      :scene="editingScene"
      :saving="saving"
      @close="closeScenePrompt"
      @save="saveScene"
    />
    <SceneBlockEditorModal
      v-if="blockEditorOpen"
      :block="editingBlock"
      :type="creatingBlockType"
      :saving="saving"
      :scene-id="selectedScene?.id"
      @close="closeBlockEditor"
      @save="saveBlock"
    />
    <UniversalRelationPickerModal
      v-if="referencePickerOpen"
      :items="referencePickerItems"
      :fixed-type="creatingBlockType"
      :creatable-types="[creatingBlockType]"
      @close="closeReferencePicker"
      @select="createReferenceBlock"
      @create="openReferenceCreate"
    />
    <SceneReferenceCreateModal
      v-if="referenceCreateOpen"
      :type="creatingBlockType"
      @close="referenceCreateOpen = false"
      @saved="createReferenceBlock"
      @error="actionError = 'Не удалось создать объект сессии'"
    />
    <ChapterEdgeModal
      v-if="nestedEdgeEditorOpen && editingNestedEdge"
      :edge="editingNestedEdge"
      title="Изменить переход"
      :saving="saving"
      @close="closeNestedEdgeEditor"
      @save="saveNestedEdge"
    />
    <GraphDeleteDialog
      v-if="pendingDelete"
      :request="pendingDelete"
      :loading="saving"
      @cancel="pendingDelete = null"
      @confirm="performDelete"
    />
  </section>
</template>

<script setup>
import { computed, inject, ref, watch } from 'vue'
import { ArrowLeft } from '@lucide/vue'
import CanvasActionDock from '@/features/sessions/components/CanvasActionDock.vue'
import CanvasHotkeyHints from '@/features/sessions/components/CanvasHotkeyHints.vue'
import ChapterEdgeModal from '@/features/sessions/components/ChapterEdgeModal.vue'
import ChapterGraphNode from '@/features/sessions/components/ChapterGraphNode.vue'
import GraphDeleteDialog from '@/features/sessions/components/GraphDeleteDialog.vue'
import NestedGraphCanvas from '@/features/sessions/components/NestedGraphCanvas.vue'
import NestedEdgeMenus from '@/features/sessions/components/NestedEdgeMenus.vue'
import SceneBlockEditorModal from '@/features/sessions/components/SceneBlockEditorModal.vue'
import SceneBlockMenus from '@/features/sessions/components/SceneBlockMenus.vue'
import SceneBlockNode from '@/features/sessions/components/SceneBlockNode.vue'
import SceneEditorModal from '@/features/sessions/components/SceneEditorModal.vue'
import SceneGraphMenus from '@/features/sessions/components/SceneGraphMenus.vue'
import SceneGraphNode from '@/features/sessions/components/SceneGraphNode.vue'
import SceneReferenceCreateModal from '@/features/sessions/components/SceneReferenceCreateModal.vue'
import UniversalRelationPickerModal from '@/features/sessions/components/UniversalRelationPickerModal.vue'
import { useNestedEdgeEditor } from '@/features/sessions/composables/useNestedEdgeEditor'
import { scenarioUsageBlockTypes, useSessionGraphBlockEditor } from '@/features/sessions/composables/useSessionGraphBlockEditor'
import { useSessionGraphNavigation } from '@/features/sessions/composables/useSessionGraphNavigation'
import { CHAPTER_STATUSES, SCENE_STATUSES } from '@/features/sessions/lib/chapterGraph'
import { narrativeCanvasActions, narrativeCanvasEmptyCopy, narrativeCanvasLoadingLabel } from '@/features/sessions/lib/narrativeCanvas'
import { buildSessionEntityCatalog } from '@/features/sessions/lib/sessionEntityRelations'

const props = defineProps({
  graph: { type: Object, required: true },
  sessionUuid: { type: String, required: true },
  isDm: { type: Boolean, default: false },
  workspaceMode: { type: String, default: null },
  workspaceChapterId: { type: [Number, String], default: null },
  workspaceScene: { type: Object, default: null },
  workspaceLevel: { type: String, default: 'chapters' },
  workspaceLayoutMode: { type: String, default: null },
  currentChapterId: { type: [Number, String], default: null },
  chapterLinkingFrom: { type: Object, default: null },
  showHotkeyLegend: { type: Boolean, default: true },
})
const emit = defineEmits([
  'node-click', 'node-double-click', 'edge-click', 'start-link', 'finish-link',
  'preview-positions', 'save-positions', 'delete-nodes', 'selection-change', 'create-chapter', 'open-chapters', 'open-scenes',
  'chapter-ancestor-click', 'scene-count', 'send-block-to-combat', 'change-nodes-status',
  'workspace-context-change',
  'drag-start', 'rewire-edge',
])

const canvas = ref(null)
const blockMenus = ref(null)
const sceneMenus = ref(null)
const edgeMenus = ref(null)
const sceneLinkingFrom = ref(null)
const blockLinkingFrom = ref(null)
const actionError = ref('')
const saving = ref(false)
const sessionMaterials = inject('sessionMaterials', null)
const sessionWorld = inject('sessionWorld', null)
const sessionPresentation = inject('sessionPresentation', null)
const scenePromptOpen = ref(false)
const editingScene = ref(null)
const sceneCreatePosition = ref({ x: 48, y: 210 })
const pendingDelete = ref(null)
const {
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
} = useSessionGraphNavigation({ props, emit, canvas })
const {
  editorOpen: nestedEdgeEditorOpen,
  editingEdge: editingNestedEdge,
  createEdge: createNestedEdge,
  beginEdit: beginNestedEdgeEdit,
  closeEditor: closeNestedEdgeEditor,
  saveEdge: saveNestedEdge,
} = useNestedEdgeEditor({ sceneGraph, blockGraph, saving, actionError })

const activeNodes = computed(() => displayLevel.value === 'chapters'
  ? props.graph.visibleChapters.value
  : displayLevel.value === 'scenes' ? sceneGraph.scenes.value : blockGraph.items.value)
const activeEdges = computed(() => displayLevel.value === 'chapters'
  ? props.graph.visibleEdges.value
  : displayLevel.value === 'scenes' ? sceneGraph.edges.value : blockGraph.edges.value)
const activeGraphKey = computed(() => graphKeyFor(displayLevel.value))
const activeFromKey = computed(() => displayLevel.value === 'chapters' ? 'fromChapterId' : displayLevel.value === 'scenes' ? 'fromSceneId' : 'fromItemId')
const activeToKey = computed(() => displayLevel.value === 'chapters' ? 'toChapterId' : displayLevel.value === 'scenes' ? 'toSceneId' : 'toItemId')
const activeNodeWidth = computed(() => displayLevel.value === 'blocks' ? 300 : 236)
const activeNodeHeight = computed(() => displayLevel.value === 'blocks' ? 96 : 156)
const activeInitialTop = computed(() => displayLevel.value === 'chapters' ? 80 : 210)
const activeLoading = computed(() => displayLevel.value === 'scenes' ? sceneGraph.loading.value : displayLevel.value === 'blocks' ? blockGraph.loading.value : false)
const activeError = computed(() => displayLevel.value === 'scenes' ? sceneGraph.error.value : displayLevel.value === 'blocks' ? blockGraph.error.value : '')
const activeLinkingFrom = computed(() => displayLevel.value === 'chapters' ? props.chapterLinkingFrom : displayLevel.value === 'scenes' ? sceneLinkingFrom.value : blockLinkingFrom.value)
const activeSpotlightId = computed(() => transitionSpotlight.value?.level === displayLevel.value
  ? transitionSpotlight.value.id
  : null)
const spotlightOffsetX = computed(() => transitionSpotlight.value?.level === displayLevel.value
  ? transitionSpotlight.value.offset
  : 0)
const showChapterAncestor = computed(() => ['scenes', 'blocks'].includes(displayLevel.value) && !!activeChapter.value)
const canvasActions = computed(() => narrativeCanvasActions(displayLevel.value))
const emptyCopy = computed(() => narrativeCanvasEmptyCopy(displayLevel.value))
const loadingLabel = computed(() => narrativeCanvasLoadingLabel(displayLevel.value))
const {
  blockEditorOpen,
  editingBlock,
  creatingBlockType,
  referencePickerOpen,
  referenceCreateOpen,
  openBlockCreate,
  closeReferencePicker,
  openReferenceCreate,
  createReferenceBlock,
  openBlockEdit,
  copyBlock,
  broadcastBlock,
  sendBlockToCombat,
  closeBlockEditor,
  saveBlock,
  refreshScenarioUsages,
} = useSessionGraphBlockEditor({
  props,
  emit,
  canvas,
  blockMenus,
  actionError,
  saving,
  sessionMaterials,
  sessionWorld,
  sessionPresentation,
  activeNodeHeight,
  activeNodeWidth,
  blockGraph,
  activeChapter,
  combatSceneContext,
})
const referencePickerItems = computed(() => {
  return buildSessionEntityCatalog(sessionWorld, sessionMaterials)
})

const backLabel = computed(() => displayLevel.value === 'blocks' ? 'К сценариям' : 'К главам')

function navigateBack() {
  closeGraphMenus()
  if (displayLevel.value === 'blocks') returnToScenes()
  else returnToChapters()
}

function openChapterAncestorMenu(event) {
  if (!props.isDm || !activeChapter.value) return
  sceneMenus.value?.close()
  blockMenus.value?.close()
  edgeMenus.value?.close()
  emit('chapter-ancestor-click', activeChapter.value, event.currentTarget)
}

function openSceneAncestorMenu(event) {
  if (!props.isDm || !selectedScene.value) return
  blockMenus.value?.close()
  edgeMenus.value?.close()
  sceneMenus.value?.openFor(selectedScene.value, event.currentTarget, 'ancestor')
}

function returnFromSceneAncestor() {
  sceneMenus.value?.close()
  returnToScenes()
}

function returnFromSceneMenu() {
  sceneMenus.value?.close()
  returnToScenes()
}

function handleNodeClick(node, anchor) {
  if (displayLevel.value === 'chapters') emit('node-click', node, anchor)
  else if (displayLevel.value === 'scenes' && props.isDm) sceneMenus.value?.openFor(node, anchor)
  else if (displayLevel.value === 'blocks' && props.isDm) blockMenus.value?.openFor(node, anchor)
}

function handleNodeDoubleClick(node) {
  if (displayLevel.value === 'chapters') emit('node-double-click', node)
  else if (displayLevel.value === 'scenes') {
    sceneMenus.value?.close()
    openBlocksLevel(node)
  }
  else {
    blockMenus.value?.close()
    openBlockEdit(node)
  }
}

function handleEdgeClick(edge, anchor) {
  if (displayLevel.value === 'chapters') emit('edge-click', edge, anchor)
  else if (props.isDm) edgeMenus.value?.openFor(edge, displayLevel.value, anchor)
}

function closeGraphMenus() {
  sceneMenus.value?.close()
  blockMenus.value?.close()
  edgeMenus.value?.close()
}

function handleSelectionChange(ids) {
  closeGraphMenus()
  emit('selection-change', ids)
}

function handleDragStart() {
  closeGraphMenus()
  emit('drag-start')
}

function startLink(node) {
  if (displayLevel.value === 'chapters') return emit('start-link', node)
  const target = displayLevel.value === 'scenes' ? sceneLinkingFrom : blockLinkingFrom
  target.value = node?.id === target.value?.id ? null : node
}

async function finishLink(node) {
  if (displayLevel.value === 'chapters') return emit('finish-link', node)
  const target = displayLevel.value === 'scenes' ? sceneLinkingFrom : blockLinkingFrom
  if (!target.value || target.value.id === node.id) return
  const from = target.value
  target.value = null
  await createNestedEdge(displayLevel.value, from, node)
}

async function updateNestedEdge(level, edge, patch, fallback) {
  const graph = level === 'scenes' ? sceneGraph : blockGraph
  edgeMenus.value?.close()
  saving.value = true
  actionError.value = ''
  try {
    await graph.updateEdge(edge.id, patch)
  } catch {
    actionError.value = fallback
  } finally {
    saving.value = false
  }
}

function toggleNestedEdgeDirection(edge, level) {
  return updateNestedEdge(level, edge, { bidirectional: !edge.bidirectional }, 'Не удалось изменить направление перехода')
}

function reverseNestedEdge(edge, level) {
  const patch = level === 'scenes'
    ? { fromSceneId: edge.toSceneId, toSceneId: edge.fromSceneId }
    : { fromItemId: edge.toItemId, toItemId: edge.fromItemId }
  return updateNestedEdge(level, edge, patch, 'Не удалось поменять направление перехода')
}

function rewireEdge(edge, from, to) {
  if (displayLevel.value === 'chapters') return emit('rewire-edge', edge, from, to)
  const patch = displayLevel.value === 'scenes'
    ? { fromSceneId: from.id, toSceneId: to.id }
    : { fromItemId: from.id, toItemId: to.id }
  return updateNestedEdge(displayLevel.value, edge, patch, 'Не удалось переставить конец перехода')
}

function openNestedEdgeEdit(edge, level) {
  edgeMenus.value?.close()
  beginNestedEdgeEdit(level, edge)
}

function requestNestedEdgeDelete(edge, level) {
  edgeMenus.value?.close()
  pendingDelete.value = { kind: 'edge', edge, level }
}

function previewPositions(positions) {
  if (displayLevel.value === 'chapters') emit('preview-positions', positions)
  else if (displayLevel.value === 'scenes') sceneGraph.setLocalPositions(positions)
  else blockGraph.setLocalPositions(positions)
}

async function savePositions(positions) {
  if (displayLevel.value === 'chapters') return emit('save-positions', positions)
  try {
    if (displayLevel.value === 'scenes') await sceneGraph.savePositions(positions)
    else await blockGraph.savePositions(positions)
  } catch { actionError.value = 'Не удалось сохранить положение выбранных карточек' }
}

function requestSelectionDelete(ids) {
  closeGraphMenus()
  if (displayLevel.value === 'chapters') return emit('delete-nodes', ids)
  pendingDelete.value = { kind: 'selection', level: displayLevel.value, ids }
}

async function changeSelectionStatus(status, ids) {
  if (displayLevel.value === 'chapters') return emit('change-nodes-status', status, ids)
  if (displayLevel.value !== 'scenes') return
  actionError.value = ''
  try { await sceneGraph.updateSceneStatuses(ids, status) } catch { actionError.value = 'Не удалось изменить статус выбранных сценариев' }
}

function previewSize(id, width) {
  if (displayLevel.value === 'blocks') blockGraph.setLocalWidth(id, width)
}

async function saveSize(id, width) {
  if (displayLevel.value !== 'blocks') return
  actionError.value = ''
  try {
    await blockGraph.saveWidth(id, width)
  } catch { actionError.value = 'Не удалось сохранить ширину блока' }
}

function runCanvasAction(action) {
  if (action === 'chapter') return emit('create-chapter')
  if (action === 'scene') return openSceneCreate()
  openBlockCreate(action)
}

function openSceneCreate() {
  editingScene.value = null
  sceneCreatePosition.value = canvas.value?.viewportCenter() ?? { x: 48, y: 210 }
  scenePromptOpen.value = true
}

function openSceneRename(scene) {
  sceneMenus.value?.close()
  editingScene.value = scene
  scenePromptOpen.value = true
}

async function changeSceneStatus(scene, status) {
  sceneMenus.value?.close()
  actionError.value = ''
  try {
    const updated = await sceneGraph.updateScene(scene.id, {
      name: scene.name,
      status,
      imageId: scene.imageId,
    })
    syncWorkspaceScene(updated)
  } catch { actionError.value = 'Не удалось изменить статус сценария' }
}

function closeScenePrompt() {
  scenePromptOpen.value = false
  editingScene.value = null
}

async function saveScene(payload) {
  saving.value = true
  actionError.value = ''
  try {
    if (editingScene.value) {
      const updated = await sceneGraph.updateScene(editingScene.value.id, payload)
      syncWorkspaceScene(updated)
    } else await sceneGraph.createScene(payload, sceneCreatePosition.value)
    await refreshScenarioUsages()
    emit('scene-count', activeChapterId.value, sceneGraph.scenes.value.length)
    closeScenePrompt()
  } catch { actionError.value = 'Не удалось сохранить сценарий' } finally { saving.value = false }
}

function syncWorkspaceScene(scene) {
  if (!scene || !props.workspaceMode) return
  const current = selectedScene.value
  emit('workspace-context-change', {
    level: props.workspaceMode === 'combat' ? props.workspaceLevel : displayLevel.value,
    scene: {
      ...scene,
      contextIndex: current?.contextIndex ?? sceneIndex(scene),
    },
  })
}

function requestSceneDelete(scene) {
  sceneMenus.value?.close()
  pendingDelete.value = { kind: 'scene', scene }
}

function requestBlockDelete(block) { pendingDelete.value = { kind: 'block', block } }

async function performDelete() {
  const value = pendingDelete.value
  if (!value) return
  saving.value = true
  actionError.value = ''
  try {
    if (value.kind === 'edge') {
      if (value.level === 'scenes') await sceneGraph.deleteEdge(value.edge.id)
      else await blockGraph.deleteEdge(value.edge.id)
    } else if (value.kind === 'selection') {
      if (value.level === 'scenes') {
        await sceneGraph.deleteScenes(value.ids)
        emit('scene-count', activeChapterId.value, sceneGraph.scenes.value.length)
        await refreshScenarioUsages()
      } else {
        const usageChanged = blockGraph.items.value.some(item => value.ids.some(id => String(id) === String(item.id)) && scenarioUsageBlockTypes.has(item.type))
        await blockGraph.deleteItems(value.ids)
        if (usageChanged) await refreshScenarioUsages()
      }
      canvas.value?.clearSelection()
    } else if (value.kind === 'scene') {
      await sceneGraph.deleteScene(value.scene.id)
      emit('scene-count', activeChapterId.value, sceneGraph.scenes.value.length)
      await refreshScenarioUsages()
    } else {
      await blockGraph.deleteItem(value.block.id)
      if (scenarioUsageBlockTypes.has(value.block.type)) await refreshScenarioUsages()
    }
    pendingDelete.value = null
  } catch { actionError.value = 'Не удалось удалить элемент' } finally { saving.value = false }
}

watch(displayLevel, () => {
  sceneLinkingFrom.value = null
  blockLinkingFrom.value = null
})

defineExpose({
  zoomBy: factor => canvas.value?.zoomBy(factor),
  viewportCenter: () => canvas.value?.viewportCenter(),
  combatContext: () => ({
    chapter: activeChapter.value,
    scene: displayLevel.value === 'blocks' ? combatSceneContext() : null,
    level: displayLevel.value,
  }),
  focusChapter: chapter => {
    if (displayLevel.value === 'chapters') canvas.value?.focusNode(chapter)
  },
})
</script>

<style scoped src="./styles/SessionGraphCanvas.css"></style>
