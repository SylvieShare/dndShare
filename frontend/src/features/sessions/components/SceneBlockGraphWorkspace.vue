<template>
  <section class="scene-block-workspace">
    <div class="scene-block-toolbar">
      <div>
        <span>БЛОКИ СЦЕНАРИЯ</span>
        <strong>{{ scene.name }}</strong>
      </div>
      <template v-if="isDm">
        <button type="button" @click="openCreate('text')">+ Текст</button>
        <button type="button" @click="openCreate('list')">+ Список</button>
      </template>
      <span class="scene-block-toolbar-divider" />
      <button type="button" title="Уменьшить" aria-label="Уменьшить" @click="canvas?.zoomBy(0.82)">−</button>
      <button type="button" title="Увеличить" aria-label="Увеличить" @click="canvas?.zoomBy(1.22)">+</button>
    </div>

    <div class="scene-block-canvas-frame">
      <NestedGraphCanvas
        ref="canvas"
        :graph-key="`blocks:${sessionUuid}:${scene.id}`"
        :nodes="graph.items.value"
        :edges="graph.edges.value"
        from-key="fromItemId"
        to-key="toItemId"
        :node-width="276"
        :node-height="180"
        :linking-from="linkingFrom"
        :can-edit="isDm"
        :loading="graph.loading.value"
        :initial-top="54"
        empty-title="Здесь появится режиссёрская схема"
        empty-description="Добавляйте блоки сценария, раскладывайте их на холсте и соединяйте переходами."
        create-label="Создать текстовый блок"
        @node-double-click="openEdit"
        @edge-click="requestEdgeDelete"
        @start-link="startLink"
        @finish-link="finishLink"
        @preview-position="graph.setLocalPosition"
        @save-position="savePosition"
        @create-first="openCreate('text')"
      >
        <template #node="{ node }">
          <SceneBlockNode
            :block="node"
            :is-dm="isDm"
            @edit="openEdit"
            @delete="requestBlockDelete"
          />
        </template>
      </NestedGraphCanvas>
      <div v-if="graph.loading.value" class="scene-nested-state">Загружаем холст блоков…</div>
      <div v-if="actionError || graph.error.value" class="scene-nested-error" role="alert">{{ actionError || graph.error.value }}</div>
    </div>

    <SceneBlockEditorModal
      v-if="editorOpen"
      :block="editingBlock"
      :type="creatingType"
      :saving="saving"
      @close="closeEditor"
      @save="saveBlock"
    />

    <ConfirmDialog
      v-if="pendingDelete"
      :title="pendingDelete.kind === 'edge' ? 'Удалить связь?' : 'Удалить блок?'"
      :message="pendingDelete.kind === 'edge' ? 'Связь между блоками будет удалена.' : `«${pendingDelete.block.title || 'Без названия'}» — действие нельзя отменить.`"
      confirm-label="Удалить"
      :loading="saving"
      @cancel="pendingDelete = null"
      @confirm="performDelete"
    />
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'
import NestedGraphCanvas from '@/features/sessions/components/NestedGraphCanvas.vue'
import SceneBlockEditorModal from '@/features/sessions/components/SceneBlockEditorModal.vue'
import SceneBlockNode from '@/features/sessions/components/SceneBlockNode.vue'
import { useSceneBlockGraph } from '@/features/sessions/composables/useSceneBlockGraph'

const props = defineProps({
  sessionUuid: { type: String, required: true },
  scene: { type: Object, required: true },
  isDm: { type: Boolean, default: false },
})

const graph = useSceneBlockGraph({ sessionUuid: props.sessionUuid, sceneId: props.scene.id })
const canvas = ref(null)
const linkingFrom = ref(null)
const editorOpen = ref(false)
const editingBlock = ref(null)
const creatingType = ref('text')
const createPosition = ref({ x: 48, y: 54 })
const pendingDelete = ref(null)
const saving = ref(false)
const actionError = ref('')

function openCreate(type) {
  if (!props.isDm) return
  editingBlock.value = null
  creatingType.value = type
  createPosition.value = canvas.value?.viewportCenter() ?? { x: 48, y: 54 }
  editorOpen.value = true
}

function openEdit(block) {
  if (!props.isDm) return
  editingBlock.value = block
  creatingType.value = block.type
  editorOpen.value = true
}

function closeEditor() {
  editorOpen.value = false
  editingBlock.value = null
}

async function saveBlock(payload) {
  saving.value = true
  actionError.value = ''
  try {
    if (editingBlock.value) await graph.updateItem(editingBlock.value.id, payload)
    else await graph.createItem(payload, createPosition.value)
    closeEditor()
  } catch {
    actionError.value = 'Не удалось сохранить блок'
  } finally {
    saving.value = false
  }
}

function startLink(block) {
  linkingFrom.value = block?.id === linkingFrom.value?.id ? null : block
}

async function finishLink(block) {
  if (!linkingFrom.value || block.id === linkingFrom.value.id) return
  const from = linkingFrom.value
  linkingFrom.value = null
  actionError.value = ''
  try {
    await graph.createEdge(from.id, block.id)
  } catch {
    actionError.value = 'Не удалось создать связь — возможно, она уже существует'
  }
}

async function savePosition(id, x, y) {
  try { await graph.savePosition(id, x, y) } catch { actionError.value = 'Не удалось сохранить положение блока' }
}

function requestBlockDelete(block) {
  pendingDelete.value = { kind: 'block', block }
}

function requestEdgeDelete(edge) {
  if (props.isDm) pendingDelete.value = { kind: 'edge', edge }
}

async function performDelete() {
  saving.value = true
  actionError.value = ''
  try {
    if (pendingDelete.value.kind === 'edge') await graph.deleteEdge(pendingDelete.value.edge.id)
    else await graph.deleteItem(pendingDelete.value.block.id)
    pendingDelete.value = null
  } catch {
    actionError.value = 'Не удалось удалить элемент'
  } finally {
    saving.value = false
  }
}

onMounted(graph.load)
</script>

<style scoped>
.scene-block-workspace { position: absolute; z-index: 18; inset: 0; pointer-events: none; }
.scene-block-toolbar {
  position: absolute;
  z-index: 30;
  top: 14px;
  right: 52px;
  left: 504px;
  height: 64px;
  display: flex;
  align-items: center;
  gap: 8px;
  pointer-events: auto;
}
.scene-block-toolbar > div { min-width: 120px; display: flex; flex-direction: column; gap: 2px; margin-right: 4px; }
.scene-block-toolbar > div span { color: var(--accent); font-size: 9px; font-weight: 850; letter-spacing: .1em; }
.scene-block-toolbar > div strong { overflow: hidden; color: var(--text-1); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.scene-block-toolbar button {
  min-width: 34px;
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  background: color-mix(in srgb, var(--surface-raised) 92%, transparent);
  color: var(--text-2);
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  backdrop-filter: blur(10px);
}
.scene-block-toolbar button:hover { color: var(--accent); border-color: var(--accent); }
.scene-block-toolbar-divider { width: 1px; height: 24px; margin-left: auto; background: var(--border); }
.scene-block-canvas-frame { position: absolute; top: 172px; right: 0; bottom: 0; left: 0; overflow: hidden; pointer-events: auto; }
.scene-nested-state,
.scene-nested-error { position: absolute; z-index: 35; top: 14px; left: 50%; padding: 8px 12px; border-radius: 7px; transform: translateX(-50%); }
.scene-nested-state { color: var(--text-muted); background: var(--popover-bg); }
.scene-nested-error { color: var(--danger); border: 1px solid color-mix(in srgb, var(--danger) 35%, transparent); background: var(--popover-bg); }
@media (max-width: 980px) {
  .scene-block-toolbar { left: 252px; }
  .scene-block-toolbar > div { display: none; }
}
</style>
