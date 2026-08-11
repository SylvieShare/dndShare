<template>
  <div class="chapter-graph-tab">
    <ChapterGraphToolbar
      :arcs="graph.arcs.value"
      :selected-arc="graph.selectedArc.value"
      :current-arc="graph.currentArc.value"
      :zoom="zoom"
      @select-arc="selectArc"
      @create-arc="openArcCreate"
      @edit-arc="openArcEdit"
      @delete-arc="confirmArcDelete"
      @move-arc="moveArc"
      @create-chapter="openChapterCreate"
      @focus-current="focusCurrent"
      @zoom="canvas?.zoomBy($event)"
    />

    <div v-if="actionError" class="chapter-action-error" role="alert">{{ actionError }}</div>
    <div v-if="graph.loading.value" class="chapter-graph-loading">Загружаем карту кампании…</div>
    <ChapterGraphCanvas
      v-else
      ref="canvas"
      :arc-id="graph.selectedArc.value?.id"
      :session-uuid="sessionUuid"
      :chapters="graph.visibleChapters.value"
      :edges="graph.visibleEdges.value"
      :current-chapter-id="graph.currentChapter.value?.id"
      :linking-from="linkingFrom"
      @node-click="openNodeMenu"
      @edge-click="openEdgeMenu"
      @start-link="startLink"
      @finish-link="finishLink"
      @preview-position="graph.setLocalPosition"
      @save-position="savePosition"
      @create-first="openChapterCreate"
      @view-change="zoom = $event.zoom"
    />

    <BasePopover v-model:open="nodeMenuOpen" :anchor="nodeAnchor" :min-width="230" placement="bottom-start">
      <div v-if="activeChapter" class="chapter-action-menu">
        <div class="chapter-action-head">
          <span>Глава {{ activeChapter.number }}</span>
          <strong>{{ activeChapter.name }}</strong>
        </div>
        <button v-if="activeChapter.id !== graph.currentChapter.value?.id" type="button" @click="makeCurrent(activeChapter)">Сделать текущей</button>
        <button type="button" @click="statusOpen = !statusOpen">Изменить статус <span class="chapter-action-chevron">›</span></button>
        <div v-if="statusOpen" class="chapter-status-list">
          <button
            v-for="status in CHAPTER_STATUSES"
            :key="status.key"
            type="button"
            :class="{ active: activeChapter.status === status.key }"
            @click="changeStatus(activeChapter, status.key)"
          >{{ status.label }}</button>
        </div>
        <button type="button" @click="editChapter(activeChapter)">Редактировать</button>
        <button type="button" @click="startLink(activeChapter)">Создать переход отсюда</button>
        <button type="button" @click="openScenes(activeChapter)">Перейти к сценам</button>
        <button v-if="graph.arcs.value.length > 1" type="button" @click="moveOpen = !moveOpen">Переместить в арку <span class="chapter-action-chevron">›</span></button>
        <div v-if="moveOpen" class="chapter-move-list">
          <button
            v-for="arc in otherArcs"
            :key="arc.id"
            type="button"
            @click="prepareMove(activeChapter, arc)"
          >{{ romanNumeral(arc.order) }} · {{ arc.name }}</button>
        </div>
        <span class="chapter-action-rule" />
        <button type="button" class="danger" @click="confirmChapterDelete(activeChapter)">Удалить главу</button>
      </div>
    </BasePopover>

    <BasePopover v-model:open="edgeMenuOpen" :anchor="edgeAnchor" :min-width="200">
      <div v-if="activeEdge" class="chapter-action-menu">
        <div class="chapter-action-head">
          <span>ПЕРЕХОД</span>
          <strong>{{ activeEdge.label || 'Без подписи' }}</strong>
        </div>
        <button type="button" @click="editEdge(activeEdge)">Изменить подпись</button>
        <button type="button" @click="reverseEdge(activeEdge)">Поменять направление</button>
        <span class="chapter-action-rule" />
        <button type="button" class="danger" @click="confirmEdgeDelete(activeEdge)">Удалить переход</button>
      </div>
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
import { computed, nextTick, ref } from 'vue'
import ArcEditorModal from '@/features/sessions/components/ArcEditorModal.vue'
import ChapterEdgeModal from '@/features/sessions/components/ChapterEdgeModal.vue'
import ChapterEditorModal from '@/features/sessions/components/ChapterEditorModal.vue'
import ChapterGraphCanvas from '@/features/sessions/components/ChapterGraphCanvas.vue'
import ChapterGraphToolbar from '@/features/sessions/components/ChapterGraphToolbar.vue'
import BasePopover from '@/shared/ui/BasePopover.vue'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'
import { CHAPTER_STATUSES, romanNumeral } from '@/features/sessions/lib/chapterGraph'

const props = defineProps({
  graph: { type: Object, required: true },
  sessionUuid: { type: String, required: true },
})
const emit = defineEmits(['open-scenes'])

const canvas = ref(null)
const zoom = ref(1)
const actionError = ref('')
const saving = ref(false)

const nodeMenuOpen = ref(false)
const nodeAnchor = ref(null)
const activeChapter = ref(null)
const statusOpen = ref(false)
const moveOpen = ref(false)

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
  activeChapter.value = chapter
  nodeAnchor.value = anchor
  statusOpen.value = false
  moveOpen.value = false
  edgeMenuOpen.value = false
  nodeMenuOpen.value = true
}

function openEdgeMenu(edge, anchor) {
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

async function savePosition(id, x, y) {
  try { await graph.savePosition(id, x, y) } catch { actionError.value = 'Не удалось сохранить положение главы' }
}

async function makeCurrent(chapter) {
  closeMenus()
  try { await perform(() => graph.makeCurrent(chapter.id), 'Не удалось изменить текущую главу') } catch { /* shown */ }
}

async function changeStatus(chapter, status) {
  const data = chapterPayload(chapter, { status })
  closeMenus()
  try { await perform(() => graph.updateChapter(chapter.id, data), 'Не удалось изменить статус') } catch { /* shown */ }
}

function startLink(chapter) {
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

async function focusCurrent() {
  const chapter = graph.focusCurrent()
  if (!chapter) return
  await nextTick()
  canvas.value?.focusChapter(chapter)
}

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
.chapter-graph-loading { display: grid; flex: 1; place-items: center; color: var(--text-muted); font-size: 13px; }
.chapter-action-error { position: absolute; z-index: 30; top: 66px; left: 50%; max-width: 520px; padding: 7px 12px; border: 1px solid color-mix(in srgb, var(--danger) 40%, transparent); border-radius: 7px; background: var(--popover-bg); color: var(--danger); font-size: 11px; transform: translateX(-50%); box-shadow: var(--shadow-lg); }

.chapter-action-menu { display: flex; min-width: 220px; flex-direction: column; gap: 2px; padding: 5px; }
.chapter-action-menu > button,
.chapter-status-list button,
.chapter-move-list button { width: 100%; padding: 8px 9px; border: 0; border-radius: 6px; background: none; color: var(--text-2); font: inherit; font-size: 12px; text-align: left; cursor: pointer; }
.chapter-action-menu button:hover { background: var(--surface-raised); color: var(--text-1); }
.chapter-action-menu button.danger { color: var(--danger); }
.chapter-action-head { display: flex; flex-direction: column; gap: 2px; padding: 6px 9px 8px; }
.chapter-action-head span { color: var(--accent); font-size: 9px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
.chapter-action-head strong { max-width: 210px; overflow: hidden; color: var(--text-1); font-family: var(--font-display); font-size: 16px; text-overflow: ellipsis; white-space: nowrap; }
.chapter-action-chevron { float: right; }
.chapter-action-rule { height: 1px; margin: 3px 5px; background: var(--border); }
.chapter-status-list,
.chapter-move-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 2px; padding: 3px; border-radius: 7px; background: color-mix(in srgb, var(--text-on-accent) 3%, transparent); }
.chapter-status-list button,
.chapter-move-list button { padding: 6px; font-size: 10px; }
.chapter-status-list button.active { background: color-mix(in srgb, var(--accent) 15%, transparent); color: var(--accent-soft); }
.chapter-move-list { grid-template-columns: 1fr; max-height: 160px; overflow-y: auto; }
</style>
