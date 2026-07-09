<template>
  <div class="scene-tab">
    <div class="scene-head">
      <div class="scene-chapters">
        <span class="scene-head-label">ГЛАВА</span>
        <button
          v-for="ch in chapters"
          :key="ch.id"
          type="button"
          class="scene-chapter-pill"
          :class="{ active: ch.id === activeChapterId }"
          @click="selectChapter(ch.id)"
        >
          <span class="scene-chapter-num">{{ romanNum(ch.number) }}</span>
          <span class="scene-chapter-name">{{ ch.name }}</span>
          <span class="scene-chapter-count">{{ chapterSceneCount[ch.id] ?? '·' }}</span>
        </button>
      </div>

      <div class="scene-picker-row">
      <div ref="pickerWrap" class="scene-picker">
        <button
          type="button"
          class="scene-picker-trigger"
          :class="{ 'scene-picker-trigger--empty': !currentScene, 'scene-picker-trigger--open': pickerOpen }"
          :disabled="!activeChapter"
          @click="togglePicker"
        >
          <span v-if="currentScene" class="scene-picker-num">{{ activeChapter ? romanNum(activeChapter.number) : '' }}·{{ currentSceneNumber }}</span>
          <span class="scene-picker-name">
            {{ currentScene ? currentScene.name : 'Сцена не выбрана' }}
          </span>
          <svg class="scene-picker-chevron" width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>

        <div v-if="pickerOpen" class="scene-picker-pop">
          <div class="scene-picker-search-wrap">
            <svg class="scene-picker-search-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4" stroke="currentColor" stroke-width="1.4"/>
              <path d="M9 9L12 12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
            <input
              ref="searchEl"
              v-model="search"
              class="scene-picker-search"
              type="text"
              placeholder="Поиск"
            />
          </div>
          <div class="scene-picker-list-wrap">
            <div v-if="scenesLoading" class="scene-picker-empty">Загрузка…</div>
            <template v-else>
              <button
                v-for="s in filteredScenes"
                :key="s.id"
                type="button"
                class="scene-picker-item"
                :class="{ active: s.id === currentSceneId }"
                @click="pickScene(s)"
              >
                <span class="scene-picker-item-num">{{ activeChapter ? romanNum(activeChapter.number) : '' }}·{{ scenes.indexOf(s) + 1 }}</span>
                <span class="scene-picker-item-name">{{ s.name }}</span>
              </button>
              <div v-if="!filteredScenes.length" class="scene-picker-empty">
                <template v-if="search">Ничего не найдено</template>
                <template v-else>Сцен в этой главе пока нет</template>
              </div>
            </template>
          </div>
          <button
            v-if="isDm"
            type="button"
            class="scene-picker-create"
            @click="openCreateModal(search)"
          >+ Новая сцена<template v-if="search.trim()"> «{{ search.trim() }}»</template></button>
        </div>
      </div>
      <template v-if="isDm && currentScene">
        <button type="button" class="scene-action-btn" title="Переименовать" @click="openRenameModal">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 12L4 11.5L11.5 4L10 2.5L2.5 10L2 12Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
          </svg>
        </button>
        <button type="button" class="scene-action-btn scene-action-btn--danger" title="Удалить сцену" @click="confirmDeleteScene">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2.5 4h9M5.5 4V2.7c0-.4.3-.7.7-.7h1.6c.4 0 .7.3.7.7V4M4 4l.5 7.5c0 .4.3.7.7.7h3.6c.4 0 .7-.3.7-.7L10 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </template>
      </div>
    </div>

    <div v-if="currentScene" class="scene-body">
      <div class="scene-body-head">
        <input
          v-if="isDm"
          class="scene-name-input"
          :value="currentScene.name"
          @change="onRenameScene"
        />
        <h3 v-else class="scene-name-static">{{ currentScene.name }}</h3>
      </div>

      <div class="scene-items" data-sortable-container="items">
        <SceneItemTile
          v-for="(item, i) in sortable.displayItems('items')"
          :key="item.id"
          :item="item"
          :is-dm="isDm"
          :is-source="sortable.isSource(item)"
          :start-in-edit="newlyCreatedId === item.id"
          :data-sortable-key="item.id"
          @drag-start="$event => sortable.startDrag($event, item, 'items', i)"
          @update="patch => updateItem(item, patch)"
          @delete="deleteItem(item)"
        />
      </div>

      <div v-if="isDm" class="scene-add-bar">
        <span class="scene-add-label">Добавить блок</span>
        <button type="button" class="scene-add-btn" @click="addItem('text')">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
            <path d="M2.5 4h9"/>
            <path d="M2.5 7h9"/>
            <path d="M2.5 10h6"/>
          </svg>
          Текст
        </button>
        <button type="button" class="scene-add-btn" @click="addItem('list')">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="3" cy="4" r="1" fill="currentColor"/>
            <circle cx="3" cy="7" r="1" fill="currentColor"/>
            <circle cx="3" cy="10" r="1" fill="currentColor"/>
            <path d="M5.5 4h7M5.5 7h7M5.5 10h5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
          Список
        </button>
      </div>
    </div>
    <div v-else-if="activeChapter" class="scene-empty-pick">Выберите или создайте сцену</div>

    <Teleport to="body">
      <div v-if="renameModalOpen" class="scene-create-overlay" @click.self="renameModalOpen = false">
        <div class="scene-create-dialog">
          <div class="scene-create-title">Переименовать сцену</div>
          <input
            ref="renameInputEl"
            v-model="renameDraft"
            class="scene-create-input"
            type="text"
            maxlength="200"
            @keydown.enter="confirmRename"
            @keydown.escape="renameModalOpen = false"
          />
          <div class="scene-create-actions">
            <button type="button" class="scene-create-cancel" @click="renameModalOpen = false">Отмена</button>
            <button
              type="button"
              class="scene-create-submit"
              :disabled="!renameDraft.trim() || renaming"
              @click="confirmRename"
            >Сохранить</button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="deleteModalOpen" class="scene-create-overlay" @click.self="deleteModalOpen = false">
        <div class="scene-create-dialog">
          <div class="scene-create-title">Удалить сцену?</div>
          <div class="scene-delete-msg">«{{ currentScene?.name }}» — действие нельзя отменить.</div>
          <div class="scene-create-actions">
            <button type="button" class="scene-create-cancel" @click="deleteModalOpen = false">Отмена</button>
            <button
              type="button"
              class="scene-create-submit scene-create-submit--danger"
              :disabled="deleting"
              @click="performDeleteScene"
            >Удалить</button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="createModalOpen" class="scene-create-overlay" @click.self="createModalOpen = false">
        <div class="scene-create-dialog">
          <div class="scene-create-title">Новая сцена</div>
          <input
            ref="createInputEl"
            v-model="createName"
            class="scene-create-input"
            type="text"
            maxlength="200"
            placeholder="Название сцены"
            @keydown.enter="confirmCreate"
            @keydown.escape="createModalOpen = false"
          />
          <div class="scene-create-actions">
            <button type="button" class="scene-create-cancel" @click="createModalOpen = false">Отмена</button>
            <button
              type="button"
              class="scene-create-submit"
              :disabled="!createName.trim() || creating"
              @click="confirmCreate"
            >Создать</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import SceneItemTile from '@/features/sessions/components/SceneItemTile.vue'
import { randomSceneColor } from '@/features/sessions/lib/scenePalette'
import { useSortable } from '@/shared/composables/useSortable'
import {
  createScene as apiCreateScene,
  createSceneItem,
  deleteScene as apiDeleteScene,
  deleteSceneItem,
  getScene,
  listScenes,
  renameScene,
  reorderSceneItems,
  updateSceneItem,
} from '@/shared/api/scenesApi'

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX']
function romanNum(n) {
  const i = Number(n)
  return ROMAN[i] || String(i)
}

const props = defineProps({
  sessionUuid: { type: String, required: true },
  chapters: { type: Array, default: () => [] },
  currentChapterId: { type: [Number, String], default: null },
  isDm: { type: Boolean, default: false },
})

const activeChapterId = ref(props.currentChapterId ?? props.chapters[0]?.id ?? null)
watch(() => props.currentChapterId, v => {
  if (v != null && activeChapterId.value == null) activeChapterId.value = v
})
watch(() => props.chapters, list => {
  if (activeChapterId.value == null && list.length) activeChapterId.value = props.currentChapterId ?? list[0].id
})

const activeChapter = computed(() => props.chapters.find(c => c.id === activeChapterId.value) || null)
const chapterSceneCount = ref({})

const scenes = ref([])
const scenesLoading = ref(false)
const search = ref('')
const currentSceneId = ref(null)
const currentScene = ref(null)
const sceneItems = ref([])
const newlyCreatedId = ref(null)

const pickerOpen = ref(false)
const pickerWrap = ref(null)
const searchEl = ref(null)

const createModalOpen = ref(false)
const createName = ref('')
const createInputEl = ref(null)
const creating = ref(false)

const renameModalOpen = ref(false)
const renameDraft = ref('')
const renameInputEl = ref(null)
const renaming = ref(false)

const deleteModalOpen = ref(false)
const deleting = ref(false)

const filteredScenes = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return scenes.value
  return scenes.value.filter(s => s.name.toLowerCase().includes(q))
})

const currentSceneNumber = computed(() => {
  if (!currentScene.value) return ''
  const i = scenes.value.findIndex(s => s.id === currentScene.value.id)
  return i >= 0 ? i + 1 : ''
})

function lastSceneKey(chapterId) {
  return `scene:last:${props.sessionUuid}:${chapterId}`
}

function readLastSceneId(chapterId) {
  try {
    const raw = localStorage.getItem(lastSceneKey(chapterId))
    if (!raw) return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : raw
  } catch { return null }
}

function writeLastSceneId(chapterId, sceneId) {
  try {
    if (sceneId == null) localStorage.removeItem(lastSceneKey(chapterId))
    else localStorage.setItem(lastSceneKey(chapterId), String(sceneId))
  } catch (_e) { /* ignore */ }
}

async function loadScenes(chapterId) {
  if (chapterId == null) {
    scenes.value = []
    return
  }
  scenesLoading.value = true
  try {
    const res = await listScenes(props.sessionUuid, chapterId)
    scenes.value = res?.scenes || []
    chapterSceneCount.value = { ...chapterSceneCount.value, [chapterId]: scenes.value.length }
    const lastId = readLastSceneId(chapterId)
    const restore = lastId != null ? scenes.value.find(s => s.id === lastId) : null
    if (restore) await selectScene(restore.id)
  } finally {
    scenesLoading.value = false
  }
}

async function selectChapter(id) {
  activeChapterId.value = id
  currentSceneId.value = null
  currentScene.value = null
  sceneItems.value = []
  search.value = ''
  pickerOpen.value = false
  await loadScenes(id)
}

async function selectScene(id) {
  currentSceneId.value = id
  const res = await getScene(props.sessionUuid, id)
  currentScene.value = res?.scene ?? null
  sceneItems.value = res?.items ?? []
  if (activeChapterId.value != null) writeLastSceneId(activeChapterId.value, id)
}

function pickScene(s) {
  pickerOpen.value = false
  search.value = ''
  selectScene(s.id)
}

function togglePicker() {
  if (!activeChapter.value) return
  pickerOpen.value = !pickerOpen.value
  if (pickerOpen.value) {
    nextTick(() => searchEl.value?.focus?.())
  }
}

function onDocClick(e) {
  if (!pickerOpen.value) return
  if (pickerWrap.value && !pickerWrap.value.contains(e.target)) {
    pickerOpen.value = false
    search.value = ''
  }
}

onMounted(() => document.addEventListener('mousedown', onDocClick))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocClick))

function openCreateModal(seed) {
  pickerOpen.value = false
  createName.value = (seed ?? search.value ?? '').trim()
  createModalOpen.value = true
  nextTick(() => createInputEl.value?.focus?.())
}

async function confirmCreate() {
  const name = createName.value.trim()
  if (!name || creating.value || activeChapterId.value == null) return
  creating.value = true
  try {
    const scene = await apiCreateScene(props.sessionUuid, activeChapterId.value, name)
    scenes.value = [...scenes.value, scene]
    chapterSceneCount.value = { ...chapterSceneCount.value, [activeChapterId.value]: scenes.value.length }
    createModalOpen.value = false
    createName.value = ''
    search.value = ''
    await selectScene(scene.id)
  } finally {
    creating.value = false
  }
}

function openRenameModal() {
  if (!currentScene.value) return
  renameDraft.value = currentScene.value.name
  renameModalOpen.value = true
  nextTick(() => renameInputEl.value?.focus?.())
}

async function confirmRename() {
  const name = renameDraft.value.trim()
  if (!currentScene.value || !name || renaming.value) return
  renaming.value = true
  try {
    const updated = await renameScene(props.sessionUuid, currentScene.value.id, name)
    currentScene.value = updated
    scenes.value = scenes.value.map(s => s.id === updated.id ? updated : s)
    renameModalOpen.value = false
  } finally {
    renaming.value = false
  }
}

function confirmDeleteScene() {
  if (!currentScene.value) return
  deleteModalOpen.value = true
}

async function performDeleteScene() {
  if (!currentScene.value || deleting.value) return
  deleting.value = true
  try {
    const sceneId = currentScene.value.id
    await apiDeleteScene(props.sessionUuid, sceneId)
    scenes.value = scenes.value.filter(s => s.id !== sceneId)
    if (activeChapterId.value != null) {
      chapterSceneCount.value = { ...chapterSceneCount.value, [activeChapterId.value]: scenes.value.length }
      writeLastSceneId(activeChapterId.value, null)
    }
    currentScene.value = null
    currentSceneId.value = null
    sceneItems.value = []
    deleteModalOpen.value = false
  } finally {
    deleting.value = false
  }
}

async function onRenameScene(e) {
  const name = e.target.value.trim()
  if (!currentScene.value || !name || name === currentScene.value.name) return
  const updated = await renameScene(props.sessionUuid, currentScene.value.id, name)
  currentScene.value = updated
  scenes.value = scenes.value.map(s => s.id === updated.id ? updated : s)
}

const sortable = useSortable({
  groups: { items: { items: sceneItems } },
  getKey: item => item.id,
  onDrop({ fromIndex, toIndex }) {
    if (fromIndex === toIndex) return
    const next = [...sceneItems.value]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    sceneItems.value = next
    if (currentScene.value) {
      reorderSceneItems(props.sessionUuid, currentScene.value.id, next.map(x => x.id)).catch(() => {})
    }
  },
})

async function addItem(type) {
  if (!currentScene.value) return
  const data = type === 'list' ? { rows: [{ left: '', right: '' }] } : { text: '' }
  const color = randomSceneColor()
  const item = await createSceneItem(props.sessionUuid, currentScene.value.id, { type, title: '', data, color })
  sceneItems.value = [...sceneItems.value, item]
  newlyCreatedId.value = item.id
}

async function updateItem(item, patch) {
  newlyCreatedId.value = null
  const payload = {}
  if ('title' in patch) payload.title = patch.title
  if (patch.dataChanged) { payload.data = patch.data; payload.dataChanged = true }
  if (patch.colorChanged) { payload.color = patch.color; payload.colorChanged = true }
  if ('order' in patch) payload.order = patch.order
  const updated = await updateSceneItem(props.sessionUuid, currentScene.value.id, item.id, payload)
  sceneItems.value = sceneItems.value.map(x => x.id === item.id ? updated : x)
}

async function deleteItem(item) {
  await deleteSceneItem(props.sessionUuid, currentScene.value.id, item.id)
  sceneItems.value = sceneItems.value.filter(x => x.id !== item.id)
}

watch(activeChapterId, id => { loadScenes(id) }, { immediate: true })
</script>

<style scoped>
.scene-tab {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 16px 18px 24px;
}

.scene-head {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--block-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px;
}

.scene-chapters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.scene-head-label {
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-right: 4px;
}

.scene-chapter-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: var(--bg-deep, #0a0b10);
  border: 1px solid var(--border);
  border-radius: 7px;
  font-family: inherit;
  font-size: 13px;
  color: var(--text-1);
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
}
.scene-chapter-pill:hover { background: color-mix(in srgb, #fff 4%, var(--bg-deep, #0a0b10)); }
.scene-chapter-pill.active {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  border-color: color-mix(in srgb, var(--accent) 50%, transparent);
  color: #fff;
}
.scene-chapter-num {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(255,255,255,0.06);
}
.scene-chapter-pill.active .scene-chapter-num { color: var(--accent); background: color-mix(in srgb, var(--accent) 18%, transparent); }
.scene-chapter-name { font-weight: 600; }
.scene-chapter-count { color: var(--text-muted); font-size: 11px; }

.scene-picker-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.scene-picker {
  position: relative;
  flex: 1;
  max-width: 400px;
}

.scene-action-btn {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  background: var(--bg-deep, #0a0b10);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-2);
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
}
.scene-action-btn:hover {
  color: var(--text-1);
  border-color: var(--border-strong);
  background: color-mix(in srgb, #fff 4%, var(--bg-deep, #0a0b10));
}
.scene-action-btn--danger:hover {
  color: #e07070;
  border-color: rgba(232, 92, 92, 0.45);
  background: rgba(232, 92, 92, 0.1);
}

.scene-picker-trigger {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  width: 100%;
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: 9px;
  font-family: inherit;
  font-size: 14px;
  color: var(--text-1);
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
}
.scene-picker-trigger:hover:not(:disabled) { border-color: var(--accent); background: var(--surface-2); }
.scene-picker-trigger:disabled { cursor: default; opacity: 0.5; }
.scene-picker-trigger--empty { color: var(--text-muted); font-style: italic; }

.scene-picker-num {
  font-size: 11px;
  font-weight: 700;
  color: var(--accent);
  padding: 2px 8px;
  border-radius: 5px;
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  flex-shrink: 0;
}

.scene-picker-name {
  flex: 1;
  text-align: left;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.scene-picker-trigger--empty .scene-picker-name { font-weight: 500; }

.scene-picker-chevron { color: var(--text-muted); flex-shrink: 0; }

.scene-picker-pop {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  background: var(--popup-bg);
  border: 1px solid var(--border-strong);
  border-radius: 12px;
  box-shadow: var(--shadow-lg);
  z-index: 200;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 60vh;
}

.scene-picker-search-wrap {
  position: relative;
  display: flex;
  align-items: center;
}
.scene-picker-search-icon {
  position: absolute;
  left: 10px;
  color: var(--text-muted);
}
.scene-picker-search {
  flex: 1;
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: 7px;
  padding: 8px 12px 8px 30px;
  font-family: inherit;
  font-size: 13px;
  color: var(--text-1);
  outline: none;
}
.scene-picker-search:focus { border-color: var(--accent); }

.scene-picker-list-wrap {
  display: flex;
  flex-direction: column;
  gap: 1px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.scene-picker-item {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 8px 10px;
  background: none;
  border: none;
  border-radius: 7px;
  font-family: inherit;
  font-size: 13px;
  color: var(--text-1);
  cursor: pointer;
  text-align: left;
  transition: background 0.12s;
}
.scene-picker-item:hover { background: rgba(255,255,255,0.05); }
.scene-picker-item.active { background: color-mix(in srgb, var(--accent) 15%, transparent); }
.scene-picker-item-num {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
  min-width: 40px;
}
.scene-picker-item-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.scene-picker-empty {
  padding: 12px;
  color: var(--text-muted);
  font-size: 12px;
  text-align: center;
}

.scene-picker-create {
  margin-top: 2px;
  display: block;
  width: 100%;
  text-align: left;
  background: none;
  border: 1px dashed var(--border-strong);
  border-radius: 7px;
  padding: 8px 12px;
  font-family: inherit;
  font-size: 13px;
  color: var(--accent);
  cursor: pointer;
}
.scene-picker-create:hover { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 6%, transparent); }

.scene-empty-pick {
  padding: 24px;
  color: var(--text-muted);
  font-size: 13px;
  text-align: center;
}

.scene-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.scene-body-head { display: flex; align-items: center; }
.scene-name-input {
  flex: 1;
  background: none;
  border: none;
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 600;
  color: var(--text-1);
  outline: none;
  padding: 4px 0;
  border-bottom: 1px solid transparent;
}
.scene-name-input:focus { border-color: var(--border-strong); }
.scene-name-static {
  margin: 0;
  font-family: var(--font-display);
  font-size: 22px;
  color: var(--text-1);
}

.scene-items {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.scene-add-bar {
  display: flex;
  gap: 10px;
  align-items: center;
  background: rgba(255,255,255,0.02);
  border: 1px dashed var(--border-strong);
  border-radius: 10px;
  padding: 12px 14px;
}
.scene-add-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-right: 4px;
}
.scene-add-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 16px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-1);
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
}
.scene-add-btn svg { color: var(--text-2); transition: color 0.12s; }
.scene-add-btn:hover {
  border-color: var(--accent);
  background: var(--surface-2);
  color: #fff;
}
.scene-add-btn:hover svg { color: var(--accent); }

.scene-create-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9200;
  padding: 16px;
}
.scene-create-dialog {
  width: 100%;
  max-width: 380px;
  background: var(--popup-bg);
  border: 1px solid var(--border-strong);
  border-radius: 12px;
  padding: 18px;
  box-shadow: var(--shadow-lg);
}
.scene-create-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
  margin-bottom: 12px;
}
.scene-create-input {
  width: 100%;
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 9px 12px;
  font-family: inherit;
  font-size: 14px;
  color: var(--text-1);
  outline: none;
}
.scene-create-input:focus { border-color: var(--accent); }
.scene-create-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 14px;
}
.scene-create-cancel,
.scene-create-submit {
  padding: 8px 14px;
  border-radius: 7px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid var(--border);
  background: var(--surface-1);
  color: var(--text-1);
}
.scene-create-cancel:hover { background: var(--surface-2); }
.scene-create-submit {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.scene-create-submit:hover:not(:disabled) { background: var(--accent-dim); }
.scene-create-submit:disabled { opacity: 0.4; cursor: not-allowed; }
.scene-create-submit--danger {
  background: #c84a4a;
  border-color: #c84a4a;
}
.scene-create-submit--danger:hover:not(:disabled) { background: #b03c3c; }

.scene-delete-msg {
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.4;
  margin-top: 4px;
}
</style>
