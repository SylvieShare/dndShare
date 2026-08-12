<template>
  <BasePopover v-model:open="nodeMenuOpen" :anchor="nodeAnchor" :min-width="230" placement="bottom-start">
    <div v-if="activeChapter" class="chapter-action-menu">
      <div class="chapter-action-head">
        <span>Глава {{ activeChapter.number }}</span>
        <strong>{{ activeChapter.name }}</strong>
      </div>
      <button type="button" class="chapter-scenes-action" @click="run('open-scenes', activeChapter)">
        <span>Сценарии главы</span>
        <strong>{{ activeChapter.sceneCount ?? 0 }}</strong>
      </button>
      <button v-if="activeChapter.id !== currentChapterId" type="button" @click="run('make-current', activeChapter)">Сделать текущей</button>
      <button type="button" @click="statusOpen = !statusOpen">Изменить статус <span class="chapter-action-chevron">›</span></button>
      <div v-if="statusOpen" class="chapter-status-list">
        <button
          v-for="status in CHAPTER_STATUSES"
          :key="status.key"
          type="button"
          :class="{ active: activeChapter.status === status.key }"
          @click="run('change-status', activeChapter, status.key)"
        >{{ status.label }}</button>
      </div>
      <button type="button" @click="run('edit-chapter', activeChapter)">Редактировать</button>
      <button type="button" @click="run('start-link', activeChapter)">Создать переход отсюда</button>
      <button v-if="arcs.length > 1" type="button" @click="moveOpen = !moveOpen">Переместить в арку <span class="chapter-action-chevron">›</span></button>
      <div v-if="moveOpen" class="chapter-move-list">
        <button
          v-for="arc in otherArcs"
          :key="arc.id"
          type="button"
          @click="run('move-chapter', activeChapter, arc)"
        >{{ romanNumeral(arc.order) }} · {{ arc.name }}</button>
      </div>
      <span class="chapter-action-rule" />
      <button type="button" class="danger" @click="run('delete-chapter', activeChapter)">Удалить главу</button>
    </div>
  </BasePopover>

  <BasePopover v-model:open="edgeMenuOpen" :anchor="edgeAnchor" :min-width="200">
    <div v-if="activeEdge" class="chapter-action-menu">
      <div class="chapter-action-head">
        <span>ПЕРЕХОД</span>
        <strong>{{ activeEdge.label || 'Без подписи' }}</strong>
      </div>
      <button type="button" @click="run('edit-edge', activeEdge)">Изменить подпись</button>
      <button type="button" @click="run('reverse-edge', activeEdge)">Поменять направление</button>
      <span class="chapter-action-rule" />
      <button type="button" class="danger" @click="run('delete-edge', activeEdge)">Удалить переход</button>
    </div>
  </BasePopover>
</template>

<script setup>
import { computed, ref } from 'vue'
import BasePopover from '@/shared/ui/BasePopover.vue'
import { CHAPTER_STATUSES, romanNumeral } from '@/features/sessions/lib/chapterGraph'

const props = defineProps({
  arcs: { type: Array, default: () => [] },
  currentChapterId: { type: Number, default: null },
})
const emit = defineEmits([
  'open-scenes', 'make-current', 'change-status', 'edit-chapter', 'start-link',
  'move-chapter', 'delete-chapter', 'edit-edge', 'reverse-edge', 'delete-edge',
])

const nodeMenuOpen = ref(false)
const nodeAnchor = ref(null)
const activeChapter = ref(null)
const statusOpen = ref(false)
const moveOpen = ref(false)
const edgeMenuOpen = ref(false)
const edgeAnchor = ref(null)
const activeEdge = ref(null)
const otherArcs = computed(() => props.arcs.filter(arc => arc.id !== activeChapter.value?.arcId))

function openNode(chapter, anchor) {
  activeChapter.value = chapter
  nodeAnchor.value = anchor
  statusOpen.value = false
  moveOpen.value = false
  edgeMenuOpen.value = false
  nodeMenuOpen.value = true
}

function openEdge(edge, anchor) {
  activeEdge.value = edge
  edgeAnchor.value = anchor
  nodeMenuOpen.value = false
  edgeMenuOpen.value = true
}

function close() {
  nodeMenuOpen.value = false
  edgeMenuOpen.value = false
}

function run(event, ...args) {
  close()
  emit(event, ...args)
}

defineExpose({ openNode, openEdge, close })
</script>

<style scoped>
.chapter-action-menu { display: flex; min-width: 220px; flex-direction: column; gap: 2px; padding: 5px; }
.chapter-action-menu > button,
.chapter-status-list button,
.chapter-move-list button { width: 100%; padding: 8px 9px; border: 0; border-radius: 6px; background: none; color: var(--text-2); font: inherit; font-size: 12px; text-align: left; cursor: pointer; }
.chapter-action-menu button:hover { background: var(--surface-raised); color: var(--text-1); }
.chapter-action-menu button.danger { color: var(--danger); }
.chapter-action-menu > button.chapter-scenes-action { display: flex; align-items: center; justify-content: space-between; border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent); background: color-mix(in srgb, var(--accent) 9%, transparent); color: var(--accent-soft); font-weight: 700; }
.chapter-scenes-action strong { min-width: 22px; padding: 2px 6px; border-radius: 10px; background: color-mix(in srgb, var(--accent) 18%, transparent); font-size: 10px; text-align: center; }
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
