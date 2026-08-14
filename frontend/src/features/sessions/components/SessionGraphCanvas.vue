<template>
  <section class="session-graph-canvas" :data-level="displayLevel">
    <NestedGraphCanvas
      ref="canvas"
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
      :layout-key="workspaceMode"
      @node-click="handleNodeClick"
      @node-double-click="handleNodeDoubleClick"
      @edge-click="handleEdgeClick"
      @start-link="startLink"
      @finish-link="finishLink"
      @preview-position="previewPosition"
      @save-position="savePosition"
      @preview-size="previewSize"
      @save-size="saveSize"
      @view-change="$emit('view-change', $event)"
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
        />
      </template>
    </NestedGraphCanvas>

    <div
      v-if="showChapterAncestor"
      class="session-graph-ancestor session-graph-ancestor--chapter"
      title="Двойной клик — к холсту глав"
      @dblclick.stop="returnToChapters"
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
      v-if="displayLevel === 'blocks' && selectedScene"
      class="session-graph-ancestor session-graph-ancestor--scene"
      title="Двойной клик — к холсту сценариев"
      @dblclick.stop="returnToScenes"
    >
      <SceneGraphNode
        :scene="selectedScene"
        :index="sceneIndex(selectedScene)"
        spotlight
      />
    </div>

    <CanvasActionDock
      v-if="isDm && workspaceMode !== 'combat'"
      :actions="canvasActions"
      @action="runCanvasAction"
    />

    <SceneBlockMenus
      ref="blockMenus"
      @edit="openBlockEdit"
      @copy="copyBlock"
      @delete="requestBlockDelete"
      @send-to-combat="sendBlockToCombat"
    />

    <SceneGraphMenus
      ref="sceneMenus"
      @edit="openSceneRename"
      @delete="requestSceneDelete"
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
      @close="closeBlockEditor"
      @save="saveBlock"
    />
    <ConfirmDialog
      v-if="pendingDelete"
      :title="deleteCopy.title"
      :message="deleteCopy.message"
      confirm-label="Удалить"
      :loading="saving"
      @cancel="pendingDelete = null"
      @confirm="performDelete"
    />
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'
import CanvasActionDock from '@/features/sessions/components/CanvasActionDock.vue'
import ChapterGraphNode from '@/features/sessions/components/ChapterGraphNode.vue'
import NestedGraphCanvas from '@/features/sessions/components/NestedGraphCanvas.vue'
import SceneBlockEditorModal from '@/features/sessions/components/SceneBlockEditorModal.vue'
import SceneBlockMenus from '@/features/sessions/components/SceneBlockMenus.vue'
import SceneBlockNode from '@/features/sessions/components/SceneBlockNode.vue'
import SceneEditorModal from '@/features/sessions/components/SceneEditorModal.vue'
import SceneGraphMenus from '@/features/sessions/components/SceneGraphMenus.vue'
import SceneGraphNode from '@/features/sessions/components/SceneGraphNode.vue'
import { useSceneBlockGraph } from '@/features/sessions/composables/useSceneBlockGraph'
import { useSceneGraph } from '@/features/sessions/composables/useSceneGraph'
import { sceneBlockDefaultWidth } from '@/features/sessions/lib/sceneBlockTypes'

const props = defineProps({
  graph: { type: Object, required: true },
  sessionUuid: { type: String, required: true },
  isDm: { type: Boolean, default: false },
  workspaceMode: { type: String, default: null },
  workspaceChapterId: { type: [Number, String], default: null },
  currentChapterId: { type: [Number, String], default: null },
  chapterLinkingFrom: { type: Object, default: null },
})
const emit = defineEmits([
  'node-click', 'node-double-click', 'edge-click', 'start-link', 'finish-link',
  'preview-position', 'save-position', 'create-chapter', 'close-workspace',
  'scene-count', 'view-change', 'send-block-to-combat',
])

const canvas = ref(null)
const blockMenus = ref(null)
const sceneMenus = ref(null)
const displayLevel = ref('chapters')
const selectedScene = ref(null)
const transitionSpotlight = ref(null)
const sceneLinkingFrom = ref(null)
const blockLinkingFrom = ref(null)
const actionError = ref('')
const saving = ref(false)
const scenePromptOpen = ref(false)
const editingScene = ref(null)
const sceneCreatePosition = ref({ x: 48, y: 210 })
const blockEditorOpen = ref(false)
const editingBlock = ref(null)
const creatingBlockType = ref('text')
const blockCreatePosition = ref({ x: 48, y: 210 })
const pendingDelete = ref(null)
let transitionTimer = null
let rememberedChapterId = null

const activeChapterId = computed(() => props.workspaceChapterId ?? rememberedChapterId)
const activeChapter = computed(() => props.graph.chapters.value.find(chapter => chapter.id === activeChapterId.value) ?? null)
const activeSceneId = computed(() => selectedScene.value?.id ?? null)
const sceneGraph = useSceneGraph({ sessionUuid: props.sessionUuid, chapterId: activeChapterId })
const blockGraph = useSceneBlockGraph({ sessionUuid: props.sessionUuid, sceneId: activeSceneId })

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
  : props.workspaceMode === 'combat' && displayLevel.value === 'chapters' ? activeChapterId.value : null)
const spotlightOffsetX = computed(() => transitionSpotlight.value?.level === displayLevel.value
  ? transitionSpotlight.value.offset
  : 0)
const showChapterAncestor = computed(() => ['scenes', 'blocks'].includes(displayLevel.value) && !!activeChapter.value)
const canvasActions = computed(() => displayLevel.value === 'chapters'
  ? [{ id: 'chapter', label: 'Новая глава', icon: 'chapter' }]
  : displayLevel.value === 'scenes'
    ? [{ id: 'scene', label: 'Новый сценарий', icon: 'scene' }]
    : [
        { id: 'text', label: 'Текстовый блок', icon: 'text' },
        { id: 'list', label: 'Список', icon: 'list' },
        { id: 'combat', label: 'Бой', icon: 'combat' },
      ])
const emptyCopy = computed(() => displayLevel.value === 'chapters'
  ? { title: 'Здесь появятся главы', description: 'Создайте первую главу и соединяйте главы переходами.' }
  : displayLevel.value === 'scenes'
    ? { title: 'Здесь появится карта сценариев', description: 'Создавайте сценарии и соединяйте их переходами.' }
    : { title: 'Здесь появится режиссёрская схема', description: 'Добавляйте блоки сценария и соединяйте их переходами.' })
const loadingLabel = computed(() => displayLevel.value === 'blocks' ? 'Загружаем блоки сценария…' : 'Загружаем сценарии…')
const deleteCopy = computed(() => {
  const value = pendingDelete.value
  if (!value) return { title: '', message: '' }
  if (value.kind === 'edge') return { title: 'Удалить связь?', message: 'Связь между карточками будет удалена.' }
  if (value.kind === 'scene') return { title: 'Удалить сценарий?', message: `«${value.scene.name}» и все его блоки будут удалены.` }
  return { title: 'Удалить блок?', message: `«${value.block.title || 'Без названия'}» — действие нельзя отменить.` }
})

function transitionDelay() {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 420
}

function graphKeyFor(level) {
  if (level === 'chapters') return `chapters:${props.sessionUuid}:${props.graph.selectedArc.value?.id ?? 'none'}`
  if (level === 'scenes') return `scenes:${props.sessionUuid}:${activeChapterId.value ?? 'none'}`
  return `blocks:${props.sessionUuid}:${activeSceneId.value ?? 'none'}`
}

function initialTopFor(level) {
  return level === 'chapters' ? 80 : 210
}

function activateLevel(level) {
  canvas.value?.prepareView(graphKeyFor(level), initialTopFor(level))
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
  rememberedChapterId = chapterId
  selectedScene.value = null
  sceneLinkingFrom.value = null
  blockLinkingFrom.value = null
  sceneGraph.reset()
  blockGraph.reset()
  sceneGraph.load().then(() => {
    if (sceneGraph.loaded.value) emit('scene-count', chapterId, sceneGraph.scenes.value.length)
  })
  transitionSpotlight.value = { level: 'chapters', id: chapterId, offset: 0 }
  scheduleTransition(() => {
    transitionSpotlight.value = null
    activateLevel('scenes')
  })
}

function openBlocksLevel(scene) {
  if (displayLevel.value !== 'scenes') return
  selectedScene.value = scene
  sceneLinkingFrom.value = null
  blockLinkingFrom.value = null
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
  if (!selectedScene.value) return
  blockLinkingFrom.value = null
  animateBack('scenes', selectedScene.value.id, 252)
}

function returnToChapters() {
  emit('close-workspace')
}

function sceneIndex(scene) {
  return sceneGraph.scenes.value.findIndex(item => item.id === scene.id)
}

function handleNodeClick(node, anchor) {
  if (displayLevel.value === 'chapters') emit('node-click', node, anchor)
  else if (displayLevel.value === 'scenes' && props.isDm) sceneMenus.value?.openFor(node, anchor)
  else if (displayLevel.value === 'blocks' && props.isDm) blockMenus.value?.openFor(node, anchor)
}

function handleNodeDoubleClick(node) {
  if (props.workspaceMode === 'combat') return
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
  else if (props.isDm) pendingDelete.value = { kind: 'edge', edge, level: displayLevel.value }
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
  actionError.value = ''
  try {
    if (displayLevel.value === 'scenes') await sceneGraph.createEdge(from.id, node.id)
    else await blockGraph.createEdge(from.id, node.id)
  } catch { actionError.value = 'Не удалось создать связь — возможно, она уже существует' }
}

function previewPosition(id, x, y) {
  if (displayLevel.value === 'chapters') emit('preview-position', id, x, y)
  else if (displayLevel.value === 'scenes') sceneGraph.setLocalPosition(id, x, y)
  else blockGraph.setLocalPosition(id, x, y)
}

async function savePosition(id, x, y) {
  if (displayLevel.value === 'chapters') return emit('save-position', id, x, y)
  try {
    if (displayLevel.value === 'scenes') await sceneGraph.savePosition(id, x, y)
    else await blockGraph.savePosition(id, x, y)
  } catch { actionError.value = 'Не удалось сохранить положение карточки' }
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

function closeScenePrompt() {
  scenePromptOpen.value = false
  editingScene.value = null
}

async function saveScene(payload) {
  saving.value = true
  actionError.value = ''
  try {
    if (editingScene.value) await sceneGraph.updateScene(editingScene.value.id, payload)
    else await sceneGraph.createScene(payload, sceneCreatePosition.value)
    emit('scene-count', activeChapterId.value, sceneGraph.scenes.value.length)
    closeScenePrompt()
  } catch { actionError.value = 'Не удалось сохранить сценарий' } finally { saving.value = false }
}

function requestSceneDelete(scene) {
  sceneMenus.value?.close()
  pendingDelete.value = { kind: 'scene', scene }
}

function openBlockCreate(type) {
  editingBlock.value = null
  creatingBlockType.value = type
  blockCreatePosition.value = canvas.value?.viewportCenter(sceneBlockDefaultWidth(type), activeNodeHeight.value) ?? { x: 48, y: 210 }
  blockEditorOpen.value = true
}

function openBlockEdit(block) {
  if (!props.isDm) return
  blockMenus.value?.close()
  editingBlock.value = block
  creatingBlockType.value = block.type
  blockEditorOpen.value = true
}

async function copyBlock(block) {
  actionError.value = ''
  try {
    const data = block.data == null ? null : JSON.parse(JSON.stringify(block.data))
    await blockGraph.createItem({
      type: block.type,
      title: `${block.title || 'Без названия'} · копия`,
      data,
      width: block.width || activeNodeWidth.value,
    }, { x: block.positionX + 32, y: block.positionY + 32 })
  } catch { actionError.value = 'Не удалось скопировать блок' }
}

function sendBlockToCombat(block) {
  blockMenus.value?.close()
  emit('send-block-to-combat', block)
}

function closeBlockEditor() {
  blockEditorOpen.value = false
  editingBlock.value = null
}

async function saveBlock(payload) {
  saving.value = true
  actionError.value = ''
  try {
    if (editingBlock.value) await blockGraph.updateItem(editingBlock.value.id, payload)
    else await blockGraph.createItem(payload, blockCreatePosition.value)
    closeBlockEditor()
  } catch { actionError.value = 'Не удалось сохранить блок' } finally { saving.value = false }
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
    } else if (value.kind === 'scene') {
      await sceneGraph.deleteScene(value.scene.id)
      emit('scene-count', activeChapterId.value, sceneGraph.scenes.value.length)
    } else await blockGraph.deleteItem(value.block.id)
    pendingDelete.value = null
  } catch { actionError.value = 'Не удалось удалить элемент' } finally { saving.value = false }
}

watch(() => props.workspaceMode, (mode, previousMode) => {
  if (mode === 'scenes' && props.workspaceChapterId != null) {
    if (previousMode !== 'scenes' || rememberedChapterId !== props.workspaceChapterId) openScenesLevel(props.workspaceChapterId)
    return
  }
  if (mode === 'combat') {
    rememberedChapterId = props.workspaceChapterId
    displayLevel.value = 'chapters'
    selectedScene.value = null
    return
  }
  if (previousMode === 'scenes') {
    const chapterId = rememberedChapterId
    animateBack('chapters', chapterId, 0)
    scheduleTransition(() => {
      sceneGraph.reset()
      blockGraph.reset()
      selectedScene.value = null
      rememberedChapterId = null
    })
  }
}, { immediate: true })

watch(() => props.workspaceChapterId, chapterId => {
  if (props.workspaceMode === 'scenes' && chapterId != null && chapterId !== rememberedChapterId) openScenesLevel(chapterId)
})

onBeforeUnmount(() => { if (transitionTimer != null) clearTimeout(transitionTimer) })

defineExpose({
  zoomBy: factor => canvas.value?.zoomBy(factor),
  viewportCenter: () => canvas.value?.viewportCenter(),
  focusChapter: chapter => {
    if (displayLevel.value === 'chapters') canvas.value?.focusNode(chapter)
  },
})
</script>

<style scoped>
.session-graph-canvas { position: absolute; inset: 0; overflow: hidden; }
.session-graph-ancestor {
  position: absolute;
  z-index: 20;
  top: 14px;
  width: 236px;
  height: 156px;
  cursor: zoom-out;
}
.session-graph-ancestor--chapter { left: var(--chapter-safe-left, 0px); }
.session-graph-ancestor--scene { left: calc(var(--chapter-safe-left, 0px) + 252px); }
.session-graph-state,
.session-graph-error {
  position: absolute;
  z-index: 30;
  top: 188px;
  left: calc(var(--chapter-safe-left, 0px) + (100% - var(--chapter-safe-left, 0px) - var(--chapter-safe-right, 0px)) / 2);
  padding: 8px 12px;
  border-radius: 7px;
  background: var(--popover-bg);
  font-size: 11px;
  transform: translateX(-50%);
  box-shadow: var(--shadow-lg);
}
.session-graph-state { color: var(--text-muted); }
.session-graph-error { color: var(--danger); border: 1px solid color-mix(in srgb, var(--danger) 35%, transparent); }
@media (max-width: 760px) {
  .session-graph-ancestor--chapter { left: 8px; }
  .session-graph-ancestor--scene { left: 260px; }
}
</style>
