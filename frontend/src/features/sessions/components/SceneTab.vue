<template>
  <div class="scene-tab">
    <div class="scene-head">
      <div v-if="arcs.length" class="scene-arcs">
        <span class="scene-head-label">АРКА</span>
        <button
          v-for="arc in arcs"
          :key="arc.id"
          type="button"
          class="scene-arc-pill"
          :class="{ active: arc.id === activeArcId }"
          @click="selectArc(arc.id)"
        >
          <span>{{ romanNumeral(arc.order) }}</span>
          {{ arc.name }}
        </button>
      </div>
      <div class="scene-chapters">
        <span class="scene-head-label">ГЛАВА</span>
        <button
          v-for="ch in arcChapters"
          :key="ch.id"
          type="button"
          class="scene-chapter-pill"
          :class="{ active: ch.id === activeChapterId }"
          @click="selectChapter(ch.id)"
        >
          <span class="scene-chapter-num">{{ ch.number }}</span>
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
          <span v-if="currentScene" class="scene-picker-num">{{ activeChapter?.number ?? '' }}·{{ currentSceneNumber }}</span>
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
                <span class="scene-picker-item-num">{{ activeChapter?.number ?? '' }}·{{ scenes.indexOf(s) + 1 }}</span>
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

    <TextPromptDialog
      v-if="renameModalOpen"
      title="Переименовать сцену"
      :value="renameDraft"
      :maxlength="200"
      :loading="renaming"
      @cancel="renameModalOpen = false"
      @confirm="confirmRename"
    />

    <ConfirmDialog
      v-if="deleteModalOpen"
      title="Удалить сцену?"
      :message="`«${currentScene?.name}» — действие нельзя отменить.`"
      confirm-label="Удалить"
      :loading="deleting"
      @cancel="deleteModalOpen = false"
      @confirm="performDeleteScene"
    />

    <TextPromptDialog
      v-if="createModalOpen"
      title="Новая сцена"
      :value="createName"
      placeholder="Название сцены"
      confirm-label="Создать"
      loading-label="Создание…"
      :maxlength="200"
      :loading="creating"
      @cancel="createModalOpen = false"
      @confirm="confirmCreate"
    />
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import SceneItemTile from '@/features/sessions/components/SceneItemTile.vue'
import { romanNumeral } from '@/features/sessions/lib/chapterGraph'
import { randomSceneColor } from '@/features/sessions/lib/scenePalette'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'
import TextPromptDialog from '@/shared/ui/TextPromptDialog.vue'
import { reorderByDrop, useSortable } from '@/shared/composables/useSortable'
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

const props = defineProps({
  sessionUuid: { type: String, required: true },
  arcs: { type: Array, default: () => [] },
  chapters: { type: Array, default: () => [] },
  currentChapterId: { type: [Number, String], default: null },
  requestedChapterId: { type: [Number, String], default: null },
  isDm: { type: Boolean, default: false },
})

const initialChapter = props.chapters.find(chapter => chapter.id === props.requestedChapterId)
  ?? props.chapters.find(chapter => chapter.id === props.currentChapterId)
  ?? props.chapters[0]
  ?? null
const activeArcId = ref(initialChapter?.arcId ?? props.arcs[0]?.id ?? null)
const arcChapters = computed(() => props.chapters.filter(chapter => chapter.arcId === activeArcId.value))
const activeChapterId = ref(initialChapter?.id ?? null)
watch(() => props.currentChapterId, v => {
  if (v != null && activeChapterId.value == null) activeChapterId.value = v
})
watch(() => props.chapters, list => {
  const active = list.find(chapter => chapter.id === activeChapterId.value)
  if (active) {
    activeArcId.value = active.arcId
  } else if (list.length) {
    const chapter = list.find(item => item.id === props.currentChapterId) ?? list[0]
    activeArcId.value = chapter.arcId
    activeChapterId.value = chapter.id
  } else {
    activeArcId.value = props.arcs[0]?.id ?? null
    activeChapterId.value = null
  }
})
watch(() => props.requestedChapterId, id => {
  if (id == null) return
  const chapter = props.chapters.find(item => item.id === id)
  if (!chapter) return
  activeArcId.value = chapter.arcId
  activeChapterId.value = chapter.id
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
const creating = ref(false)

const renameModalOpen = ref(false)
const renameDraft = ref('')
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
}

function selectArc(id) {
  activeArcId.value = id
  const current = props.chapters.find(chapter => chapter.id === props.currentChapterId && chapter.arcId === id)
  selectChapter(current?.id ?? props.chapters.find(chapter => chapter.arcId === id)?.id ?? null)
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
}

async function confirmCreate(value) {
  const name = value.trim()
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
}

async function confirmRename(value) {
  const name = value.trim()
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
    const next = reorderByDrop(sceneItems.value, fromIndex, toIndex)
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

<style scoped src="./styles/SceneTab.css"></style>
