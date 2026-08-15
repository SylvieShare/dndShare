<template>
  <div class="chapter-graph-tab">
    <ChapterGraphToolbar
      :arcs="graph.arcs.value"
      :selected-arc="graph.selectedArc.value"
      :current-arc="graph.currentArc.value"
      :session="session"
      :session-uuid="sessionUuid"
      :is-dm="isDm"
      :locked="locked"
      :combat-active="workspaceMode === 'combat'"
      :dice-open="diceOpen"
      :music-open="musicOpen"
      :events-open="eventsOpen"
      @select-arc="selectArc"
      @create-arc="openArcCreate"
      @edit-arc="openArcEdit"
      @delete-arc="confirmArcDelete"
      @move-arc="moveArc"
      @edit-session="$emit('edit-session')"
      @status-change="$emit('status-change', $event)"
      @open-combat="$emit('open-combat')"
      @toggle-dice="$emit('toggle-dice')"
      @toggle-music="$emit('toggle-music')"
      @toggle-events="$emit('toggle-events')"
    />

    <div class="chapter-canvas-stage">
      <div v-if="actionError" class="chapter-action-error" role="alert">{{ actionError }}</div>
      <div v-if="graph.loading.value" class="chapter-graph-loading">Загружаем карту кампании…</div>
      <SessionGraphCanvas
        v-else
        ref="canvas"
        :graph="graph"
        :session-uuid="sessionUuid"
        :is-dm="isDm"
        :current-chapter-id="graph.currentChapter.value?.id"
        :workspace-mode="workspaceMode"
        :workspace-chapter-id="workspaceChapterId"
        :chapter-linking-from="linkingFrom"
        @node-click="openNodeMenu"
        @node-double-click="openScenes"
        @edge-click="openEdgeMenu"
        @start-link="startLink"
        @finish-link="finishLink"
        @preview-positions="graph.setLocalPositions"
        @save-positions="savePositions"
        @selection-change="closeMenus"
        @delete-nodes="confirmChaptersDelete"
        @change-nodes-status="changeSelectionStatus"
        @create-chapter="openChapterCreate"
        @close-workspace="returnToChapters"
        @chapter-ancestor-click="openChapterAncestorMenu"
        @scene-count="graph.setSceneCount"
        @send-block-to-combat="$emit('send-block-to-combat', $event)"
      />
      <slot />
    </div>

    <BasePopover
      v-model:open="nodeMenuOpen"
      :anchor="nodeAnchor"
      :min-width="230"
      placement="bottom-start"
      transition-preset="action-menu"
      role="menu"
      :aria-label="activeChapter ? `Действия с главой ${activeChapter.number}` : 'Действия с главой'"
    >
      <template v-if="activeChapter">
        <RowActionItem v-if="nodeMenuContext === 'ancestor'" :icon="ArrowLeft" tone="accent" @click="returnToChapters">
          Вернуться к главам
        </RowActionItem>
        <template v-else>
          <RowActionItem action="view" tone="accent" @click="openScenes(activeChapter)">
            Сценарии главы
            <template #suffix>{{ activeChapter.sceneCount ?? 0 }}</template>
          </RowActionItem>
          <RowActionItem
            v-if="activeChapter.id !== graph.currentChapter.value?.id"
            :icon="CircleDot"
            @click="makeCurrent(activeChapter)"
          >Отметить «Сейчас здесь»</RowActionItem>
        </template>
        <RowActionSubmenu label="Статус главы" :min-width="230">
          <template #trigger="{ open }">
            <RowActionItem :icon="ListChecks" submenu :submenu-open="open">Изменить статус</RowActionItem>
          </template>
          <RowActionItem
            v-for="status in CHAPTER_STATUSES"
            :key="status.key"
            :icon="activeChapter.status === status.key ? Check : Circle"
            :style="{ color: status.color }"
            @click="changeStatus(activeChapter, status.key)"
          >{{ status.label }}</RowActionItem>
        </RowActionSubmenu>
        <RowActionItem action="edit" @click="editChapter(activeChapter)">Редактировать</RowActionItem>
        <template v-if="nodeMenuContext !== 'ancestor'">
          <RowActionItem :icon="GitBranchPlus" @click="startLink(activeChapter)">Создать переход отсюда</RowActionItem>
          <RowActionSubmenu v-if="otherArcs.length" label="Переместить в арку" :min-width="220">
            <template #trigger="{ open }">
              <RowActionItem :icon="FolderInput" submenu :submenu-open="open">Переместить в арку</RowActionItem>
            </template>
            <RowActionItem
              v-for="arc in otherArcs"
              :key="arc.id"
              :icon="FolderInput"
              @click="prepareMove(activeChapter, arc)"
            >{{ romanNumeral(arc.order) }} · {{ arc.name }}</RowActionItem>
          </RowActionSubmenu>
          <RowActionItem action="delete" tone="danger" @click="confirmChapterDelete(activeChapter)">Удалить главу</RowActionItem>
        </template>
      </template>
    </BasePopover>

    <BasePopover
      v-model:open="edgeMenuOpen"
      :anchor="edgeAnchor"
      :min-width="210"
      transition-preset="action-menu"
      role="menu"
      aria-label="Действия с переходом"
    >
      <template v-if="activeEdge">
        <RowActionItem action="edit" @click="editEdge(activeEdge)">Изменить подпись</RowActionItem>
        <RowActionItem :icon="ArrowLeftRight" @click="reverseEdge(activeEdge)">Поменять направление</RowActionItem>
        <RowActionItem action="delete" tone="danger" @click="confirmEdgeDelete(activeEdge)">Удалить переход</RowActionItem>
      </template>
    </BasePopover>

    <ArcEditorModal
      v-if="arcEditorOpen"
      :arc="editingArc"
      :saving="saving"
      @close="closeEditors"
      @save="saveArc"
    />
    <ChapterEditorModal
      v-if="chapterEditorOpen && graph.selectedArc.value"
      :chapter="editingChapter"
      :arc-id="graph.selectedArc.value.id"
      :position="newChapterPosition"
      :saving="saving"
      @close="closeEditors"
      @save="saveChapter"
    />
    <ChapterEdgeModal
      v-if="edgeEditorOpen"
      :edge="editingEdge"
      :title="edgeEditorTitle"
      :saving="saving"
      @close="closeEditors"
      @save="saveEdge"
    />

    <ConfirmDialog
      v-if="confirmState"
      :title="confirmState.title"
      :message="confirmState.message"
      :confirm-label="confirmState.confirmLabel"
      :loading="saving"
      @cancel="confirmState = null"
      @confirm="runConfirmedAction"
    />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ArrowLeft, ArrowLeftRight, Check, Circle, CircleDot, FolderInput, GitBranchPlus, ListChecks } from '@lucide/vue'
import ArcEditorModal from '@/features/sessions/components/ArcEditorModal.vue'
import ChapterEdgeModal from '@/features/sessions/components/ChapterEdgeModal.vue'
import ChapterEditorModal from '@/features/sessions/components/ChapterEditorModal.vue'
import ChapterGraphToolbar from '@/features/sessions/components/ChapterGraphToolbar.vue'
import SessionGraphCanvas from '@/features/sessions/components/SessionGraphCanvas.vue'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import { BasePopover, ConfirmDialog, RowActionSubmenu } from '@sylvieshare/share-ui'
import { CHAPTER_STATUSES, romanNumeral } from '@/features/sessions/lib/chapterGraph'

const props = defineProps({
  graph: { type: Object, required: true },
  sessionUuid: { type: String, required: true },
  session: { type: Object, default: null },
  isDm: { type: Boolean, default: false },
  locked: { type: Boolean, default: false },
  workspaceChapterId: { type: [Number, String], default: null },
  workspaceMode: { type: String, default: null },
  diceOpen: { type: Boolean, default: true },
  musicOpen: { type: Boolean, default: true },
  eventsOpen: { type: Boolean, default: true },
})
const emit = defineEmits([
  'open-scenes', 'open-combat', 'edit-session', 'status-change', 'close-workspace',
  'send-block-to-combat', 'toggle-dice', 'toggle-music', 'toggle-events',
])

const canvas = ref(null)
const actionError = ref('')
const saving = ref(false)

const nodeMenuOpen = ref(false)
const nodeAnchor = ref(null)
const activeChapter = ref(null)
const nodeMenuContext = ref('node')
const edgeMenuOpen = ref(false)
const edgeAnchor = ref(null)
const activeEdge = ref(null)

const arcEditorOpen = ref(false)
const editingArc = ref(null)
const chapterEditorOpen = ref(false)
const editingChapter = ref(null)
const newChapterPosition = ref({ x: 80, y: 80 })
const edgeEditorOpen = ref(false)
const editingEdge = ref(null)
const pendingEdge = ref(null)
const linkingFrom = ref(null)
const confirmState = ref(null)

const graph = props.graph
const otherArcs = computed(() => graph.arcs.value.filter(arc => arc.id !== activeChapter.value?.arcId))
const edgeEditorTitle = computed(() => {
  if (editingEdge.value) return 'Изменить переход'
  const from = pendingEdge.value?.from
  const to = pendingEdge.value?.to
  return from && to ? `${from.name} → ${to.name}` : 'Новый переход'
})

function selectArc(id) {
  closeMenus()
  linkingFrom.value = null
  graph.selectArc(id)
}

function openNodeMenu(chapter, anchor) {
  if (props.locked) return
  nodeMenuContext.value = 'node'
  activeChapter.value = chapter
  nodeAnchor.value = anchor
  edgeMenuOpen.value = false
  nodeMenuOpen.value = true
}

function openChapterAncestorMenu(chapter, anchor) {
  nodeMenuContext.value = 'ancestor'
  activeChapter.value = chapter
  nodeAnchor.value = anchor
  edgeMenuOpen.value = false
  nodeMenuOpen.value = true
}

function openEdgeMenu(edge, anchor) {
  if (props.locked) return
  activeEdge.value = edge
  edgeAnchor.value = anchor
  nodeMenuOpen.value = false
  edgeMenuOpen.value = true
}

function closeMenus() {
  nodeMenuOpen.value = false
  edgeMenuOpen.value = false
}

function openArcCreate() {
  editingArc.value = null
  arcEditorOpen.value = true
}

function openArcEdit() {
  editingArc.value = graph.selectedArc.value
  if (editingArc.value) arcEditorOpen.value = true
}

function openChapterCreate() {
  editingChapter.value = null
  newChapterPosition.value = canvas.value?.viewportCenter() ?? { x: 80, y: 80 }
  chapterEditorOpen.value = true
}

function editChapter(chapter) {
  closeMenus()
  editingChapter.value = chapter
  chapterEditorOpen.value = true
}

function closeEditors() {
  arcEditorOpen.value = false
  chapterEditorOpen.value = false
  edgeEditorOpen.value = false
  editingArc.value = null
  editingChapter.value = null
  editingEdge.value = null
  pendingEdge.value = null
}

async function perform(action, fallback) {
  saving.value = true
  actionError.value = ''
  try {
    return await action()
  } catch {
    actionError.value = fallback
    throw new Error(fallback)
  } finally {
    saving.value = false
  }
}

async function saveArc(data) {
  try {
    await perform(
      () => editingArc.value ? graph.updateArc(editingArc.value.id, data) : graph.createArc(data),
      'Не удалось сохранить арку',
    )
    closeEditors()
  } catch { /* message is shown */ }
}

async function saveChapter(data) {
  try {
    const chapter = await perform(
      () => editingChapter.value ? graph.updateChapter(editingChapter.value.id, data) : graph.createChapter(data),
      'Не удалось сохранить главу. Проверьте, не занят ли её номер.',
    )
    if (!editingChapter.value && !graph.currentChapter.value) await graph.makeCurrent(chapter.id)
    closeEditors()
  } catch { /* message is shown */ }
}

async function savePositions(positions) {
  try { await graph.savePositions(positions) } catch { actionError.value = 'Не удалось сохранить положение выбранных глав' }
}

async function makeCurrent(chapter) {
  closeMenus()
  try { await perform(() => graph.makeCurrent(chapter.id), 'Не удалось отметить, где сейчас группа') } catch { /* shown */ }
}

async function changeStatus(chapter, status) {
  const data = chapterPayload(chapter, { status })
  closeMenus()
  try { await perform(() => graph.updateChapter(chapter.id, data), 'Не удалось изменить статус') } catch { /* shown */ }
}

async function changeSelectionStatus(status, ids) {
  try {
    await perform(() => graph.updateChapterStatuses(ids, status), 'Не удалось изменить статус выбранных глав')
  } catch { /* shown */ }
}

function startLink(chapter) {
  if (props.locked) return
  closeMenus()
  linkingFrom.value = chapter?.id === linkingFrom.value?.id ? null : chapter
}

function finishLink(chapter) {
  if (!linkingFrom.value || chapter.id === linkingFrom.value.id) return
  pendingEdge.value = { from: linkingFrom.value, to: chapter }
  linkingFrom.value = null
  editingEdge.value = null
  edgeEditorOpen.value = true
}

function editEdge(edge) {
  closeMenus()
  editingEdge.value = edge
  edgeEditorOpen.value = true
}

async function saveEdge(label) {
  const edge = editingEdge.value
  const from = edge ? graph.chapters.value.find(chapter => chapter.id === edge.fromChapterId) : pendingEdge.value?.from
  const to = edge ? graph.chapters.value.find(chapter => chapter.id === edge.toChapterId) : pendingEdge.value?.to
  if (!from || !to) return
  const data = { arcId: from.arcId, fromChapterId: from.id, toChapterId: to.id, label }
  try {
    await perform(() => edge ? graph.updateEdge(edge.id, data) : graph.createEdge(data), 'Не удалось сохранить переход')
    closeEditors()
  } catch { /* shown */ }
}

async function reverseEdge(edge) {
  closeMenus()
  try {
    await perform(() => graph.updateEdge(edge.id, {
      arcId: edge.arcId,
      fromChapterId: edge.toChapterId,
      toChapterId: edge.fromChapterId,
      label: edge.label ?? null,
    }), 'Не удалось поменять направление перехода')
  } catch { /* shown */ }
}

function openScenes(chapter) {
  closeMenus()
  emit('open-scenes', chapter)
}

function returnToChapters() {
  closeMenus()
  emit('close-workspace')
}

function prepareMove(chapter, arc) {
  closeMenus()
  const linked = graph.edges.value.some(edge => edge.fromChapterId === chapter.id || edge.toChapterId === chapter.id)
  confirmState.value = {
    kind: 'move', chapter, arc,
    title: 'Переместить главу?',
    message: linked
      ? `Глава «${chapter.name}» будет перенесена в арку «${arc.name}». Её переходы будут удалены.`
      : `Глава «${chapter.name}» будет перенесена в арку «${arc.name}».`,
    confirmLabel: 'Переместить',
  }
}

function confirmArcDelete() {
  const arc = graph.selectedArc.value
  if (!arc) return
  confirmState.value = { kind: 'arc', arc, title: 'Удалить арку?', message: `Удалить пустую арку «${arc.name}»?`, confirmLabel: 'Удалить' }
}

function confirmChapterDelete(chapter) {
  closeMenus()
  confirmState.value = { kind: 'chapter', chapter, title: 'Удалить главу?', message: `Глава «${chapter.name}» и её переходы будут удалены. Главу со сценами удалить нельзя.`, confirmLabel: 'Удалить' }
}

function confirmChaptersDelete(ids) {
  closeMenus()
  confirmState.value = {
    kind: 'chapters',
    ids,
    title: `Удалить главы: ${ids.length}?`,
    message: 'Выбранные главы и связанные переходы будут удалены. Если хотя бы в одной главе есть сценарии, ничего не удалится.',
    confirmLabel: 'Удалить',
  }
}

function confirmEdgeDelete(edge) {
  closeMenus()
  confirmState.value = { kind: 'edge', edge, title: 'Удалить переход?', message: edge.label ? `Удалить переход «${edge.label}»?` : 'Удалить этот переход?', confirmLabel: 'Удалить' }
}

async function runConfirmedAction() {
  const state = confirmState.value
  if (!state) return
  try {
    if (state.kind === 'arc') await perform(() => graph.deleteArc(state.arc.id), 'Удалить можно только пустую арку')
    if (state.kind === 'chapter') await perform(() => graph.deleteChapter(state.chapter.id), 'Не удалось удалить главу. Возможно, к ней привязаны сцены.')
    if (state.kind === 'chapters') await perform(() => graph.deleteChapters(state.ids), 'Не удалось удалить главы. Возможно, к одной из них привязаны сценарии.')
    if (state.kind === 'edge') await perform(() => graph.deleteEdge(state.edge.id), 'Не удалось удалить переход')
    if (state.kind === 'move') {
      await perform(() => graph.moveChapterToArc(state.chapter.id, state.arc.id, 80, 80), 'Не удалось переместить главу')
      graph.selectArc(state.arc.id)
    }
    confirmState.value = null
  } catch { /* shown */ }
}

async function moveArc(id, delta) {
  const ids = graph.arcs.value.map(arc => arc.id)
  const from = ids.indexOf(id)
  const to = from + delta
  if (from < 0 || to < 0 || to >= ids.length) return
  ids.splice(to, 0, ids.splice(from, 1)[0])
  try { await perform(() => graph.reorderArcs(ids), 'Не удалось изменить порядок арок') } catch { /* shown */ }
}

watch(() => props.locked, locked => {
  if (!locked) return
  closeMenus()
  linkingFrom.value = null
})

function chapterPayload(chapter, patch = {}) {
  return {
    arcId: chapter.arcId,
    number: chapter.number,
    name: chapter.name,
    description: chapter.description ?? null,
    status: chapter.status,
    imagePresetKey: chapter.imagePresetKey ?? null,
    customImageId: chapter.customImageId ?? null,
    imageFocalX: chapter.imageFocalX,
    imageFocalY: chapter.imageFocalY,
    positionX: chapter.positionX,
    positionY: chapter.positionY,
    ...patch,
  }
}
</script>

<style scoped>
.chapter-graph-tab { position: relative; display: flex; flex: 1; min-height: 0; flex-direction: column; overflow: hidden; }
.chapter-canvas-stage { position: relative; display: flex; flex: 1; min-height: 0; overflow: hidden; }
.chapter-graph-loading { display: grid; flex: 1; place-items: center; color: var(--text-muted); font-size: 13px; }
.chapter-action-error { position: absolute; z-index: 30; top: 66px; left: 50%; max-width: 520px; padding: 7px 12px; border: 1px solid color-mix(in srgb, var(--danger) 40%, transparent); border-radius: 7px; background: var(--popover-bg); color: var(--danger); font-size: 11px; transform: translateX(-50%); box-shadow: var(--shadow-lg); }

</style>
