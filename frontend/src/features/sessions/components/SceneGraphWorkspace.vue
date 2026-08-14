<template>
  <section class="scene-graph-workspace">
    <button
      type="button"
      class="scene-graph-chapter-hit"
      title="Двойной клик — к холсту глав"
      aria-label="Вернуться к холсту глав"
      @dblclick.stop="$emit('exit')"
    />
    <NestedGraphCanvas
      ref="canvas"
      :graph-key="`scenes:${sessionUuid}:${chapter.id}`"
      :nodes="graph.scenes.value"
      :edges="graph.edges.value"
      from-key="fromSceneId"
      to-key="toSceneId"
      :node-width="236"
      :node-height="156"
      :linking-from="linkingFrom"
      :can-edit="isDm"
      :loading="graph.loading.value"
      :locked="depth === 'blocks'"
      :spotlight-node-id="depth === 'blocks' ? selectedScene?.id : null"
      :initial-top="210"
      empty-title="Здесь появится карта сценариев"
      empty-description="Создайте первый сценарий, разместите его на холсте и соединяйте сценарии переходами."
      create-label="Создать первый сценарий"
      @node-double-click="toggleSceneLevel"
      @edge-click="requestEdgeDelete"
      @start-link="startLink"
      @finish-link="finishLink"
      @preview-position="graph.setLocalPosition"
      @save-position="savePosition"
      @create-first="openCreate"
    >
      <template #node="{ node, spotlight }">
        <SceneGraphNode
          :scene="node"
          :index="sceneIndex(node)"
          :is-dm="isDm"
          :spotlight="spotlight"
          @edit="openRename"
          @delete="requestSceneDelete"
        />
      </template>
    </NestedGraphCanvas>

    <div class="scene-graph-toolbar" :class="{ 'scene-graph-toolbar--blocks': depth === 'blocks' }">
      <div>
        <span>СЦЕНАРИИ ГЛАВЫ</span>
        <strong>{{ chapter.name }}</strong>
      </div>
      <button v-if="isDm && depth === 'scenes'" type="button" @click="openCreate">+ Сценарий</button>
      <span class="scene-graph-toolbar-divider" />
      <button type="button" title="Уменьшить" aria-label="Уменьшить" @click="canvas?.zoomBy(0.82)">−</button>
      <button type="button" title="Увеличить" aria-label="Увеличить" @click="canvas?.zoomBy(1.22)">+</button>
    </div>

    <div v-if="graph.loading.value" class="scene-nested-state">Загружаем холст сценариев…</div>
    <div v-if="actionError || graph.error.value" class="scene-nested-error" role="alert">{{ actionError || graph.error.value }}</div>

    <SceneBlockGraphWorkspace
      v-if="depth === 'blocks' && selectedScene"
      :key="selectedScene.id"
      :session-uuid="sessionUuid"
      :scene="selectedScene"
      :is-dm="isDm"
    />

    <TextPromptDialog
      v-if="promptOpen"
      :title="editingScene ? 'Переименовать сценарий' : 'Новый сценарий'"
      :value="editingScene?.name || ''"
      placeholder="Название сценария"
      :confirm-label="editingScene ? 'Сохранить' : 'Создать'"
      :loading="saving"
      @cancel="closePrompt"
      @confirm="saveScene"
    />

    <ConfirmDialog
      v-if="pendingDelete"
      :title="pendingDelete.kind === 'edge' ? 'Удалить связь?' : 'Удалить сценарий?'"
      :message="pendingDelete.kind === 'edge' ? 'Связь между сценариями будет удалена.' : `«${pendingDelete.scene.name}» и все его блоки будут удалены.`"
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
import TextPromptDialog from '@/shared/ui/TextPromptDialog.vue'
import NestedGraphCanvas from '@/features/sessions/components/NestedGraphCanvas.vue'
import SceneBlockGraphWorkspace from '@/features/sessions/components/SceneBlockGraphWorkspace.vue'
import SceneGraphNode from '@/features/sessions/components/SceneGraphNode.vue'
import { useSceneGraph } from '@/features/sessions/composables/useSceneGraph'

const props = defineProps({
  sessionUuid: { type: String, required: true },
  chapter: { type: Object, required: true },
  isDm: { type: Boolean, default: false },
})
const emit = defineEmits(['scene-count', 'exit'])

const graph = useSceneGraph({ sessionUuid: props.sessionUuid, chapterId: props.chapter.id })
const canvas = ref(null)
const depth = ref('scenes')
const selectedScene = ref(null)
const linkingFrom = ref(null)
const promptOpen = ref(false)
const editingScene = ref(null)
const createPosition = ref({ x: 48, y: 210 })
const pendingDelete = ref(null)
const saving = ref(false)
const actionError = ref('')

function sceneIndex(scene) {
  return graph.scenes.value.findIndex(item => item.id === scene.id)
}

function toggleSceneLevel(scene) {
  if (depth.value === 'blocks' && selectedScene.value?.id === scene.id) {
    depth.value = 'scenes'
    selectedScene.value = null
    return
  }
  selectedScene.value = scene
  depth.value = 'blocks'
}

function openCreate() {
  if (!props.isDm || depth.value !== 'scenes') return
  editingScene.value = null
  createPosition.value = canvas.value?.viewportCenter() ?? { x: 48, y: 210 }
  promptOpen.value = true
}

function openRename(scene) {
  editingScene.value = scene
  promptOpen.value = true
}

function closePrompt() {
  promptOpen.value = false
  editingScene.value = null
}

async function saveScene(name) {
  saving.value = true
  actionError.value = ''
  try {
    if (editingScene.value) await graph.renameScene(editingScene.value.id, name)
    else await graph.createScene(name, createPosition.value)
    emit('scene-count', props.chapter.id, graph.scenes.value.length)
    closePrompt()
  } catch {
    actionError.value = 'Не удалось сохранить сценарий'
  } finally {
    saving.value = false
  }
}

function startLink(scene) {
  linkingFrom.value = scene?.id === linkingFrom.value?.id ? null : scene
}

async function finishLink(scene) {
  if (!linkingFrom.value || scene.id === linkingFrom.value.id) return
  const from = linkingFrom.value
  linkingFrom.value = null
  actionError.value = ''
  try {
    await graph.createEdge(from.id, scene.id)
  } catch {
    actionError.value = 'Не удалось создать связь — возможно, она уже существует'
  }
}

async function savePosition(id, x, y) {
  try { await graph.savePosition(id, x, y) } catch { actionError.value = 'Не удалось сохранить положение сценария' }
}

function requestSceneDelete(scene) {
  pendingDelete.value = { kind: 'scene', scene }
}

function requestEdgeDelete(edge) {
  if (props.isDm && depth.value === 'scenes') pendingDelete.value = { kind: 'edge', edge }
}

async function performDelete() {
  saving.value = true
  actionError.value = ''
  try {
    if (pendingDelete.value.kind === 'edge') await graph.deleteEdge(pendingDelete.value.edge.id)
    else {
      await graph.deleteScene(pendingDelete.value.scene.id)
      emit('scene-count', props.chapter.id, graph.scenes.value.length)
    }
    pendingDelete.value = null
  } catch {
    actionError.value = 'Не удалось удалить элемент'
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await graph.load()
  emit('scene-count', props.chapter.id, graph.scenes.value.length)
})
</script>

<style scoped>
.scene-graph-workspace { position: absolute; inset: 0; overflow: hidden; pointer-events: auto; }
.scene-graph-chapter-hit {
  position: absolute;
  z-index: 45;
  top: 0;
  left: 0;
  width: 236px;
  height: 156px;
  padding: 0;
  border: 0;
  border-radius: 13px;
  background: transparent;
  cursor: zoom-out;
}
.scene-graph-toolbar {
  position: absolute;
  z-index: 26;
  top: 14px;
  right: 52px;
  left: 252px;
  height: 64px;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: opacity .18s ease;
}
.scene-graph-toolbar--blocks { opacity: 0; pointer-events: none; }
.scene-graph-toolbar > div { min-width: 140px; display: flex; flex-direction: column; gap: 2px; margin-right: 4px; }
.scene-graph-toolbar > div span { color: var(--accent); font-size: 9px; font-weight: 850; letter-spacing: .1em; }
.scene-graph-toolbar > div strong { overflow: hidden; color: var(--text-1); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.scene-graph-toolbar button {
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
.scene-graph-toolbar button:hover { color: var(--accent); border-color: var(--accent); }
.scene-graph-toolbar-divider { width: 1px; height: 24px; margin-left: auto; background: var(--border); }
.scene-nested-state,
.scene-nested-error { position: absolute; z-index: 40; top: 184px; left: 50%; padding: 8px 12px; border-radius: 7px; transform: translateX(-50%); }
.scene-nested-state { color: var(--text-muted); background: var(--popover-bg); }
.scene-nested-error { color: var(--danger); border: 1px solid color-mix(in srgb, var(--danger) 35%, transparent); background: var(--popover-bg); }
@media (max-width: 760px) {
  .scene-graph-toolbar { left: 0; padding-left: 8px; }
  .scene-graph-toolbar > div { display: none; }
}
</style>
