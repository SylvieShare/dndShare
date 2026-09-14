<template>
  <div class="chapter-toolbar-left">
    <SessionStatusControl v-if="session" :session="session" :is-dm="isDm" @updated="emit('session-updated', $event)" />
    <div class="chapter-session-context">
      <div v-if="session" class="chapter-session">
        <button
          type="button"
          class="chapter-session-title"
          :disabled="!isDm"
          :title="isDm ? 'Редактировать сессию' : session.name"
          @click="emit('edit-session')"
        >{{ session.name }}</button>
      </div>

      <div class="chapter-toolbar-main">
        <button ref="arcTrigger" type="button" class="chapter-arc-trigger" :disabled="locked" :aria-expanded="arcOpen" @click="arcOpen = !arcOpen">
          <span class="chapter-arc-prefix">АРКА</span>
          <span class="chapter-arc-number">{{ romanNumeral(selectedArc?.order) }}</span>
          <span class="chapter-arc-name">{{ selectedArc?.name || 'Выберите арку' }}</span>
          <svg class="chapter-arc-chevron" width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>

        <BasePopover v-model:open="arcOpen" :anchor="arcTrigger" :min-width="300" transition-preset="action-menu">
          <div class="chapter-arc-list" data-sortable-container="arcs">
            <div
              v-for="(arc, index) in displayedArcs"
              :key="arc.id"
              class="chapter-arc-row"
              :class="{
                active: arc.id === selectedArc?.id,
                'chapter-arc-row--sortable': canReorderArcs,
                'chapter-arc-row--placeholder': arcSortable.isSource(arc),
              }"
              :data-sortable-key="arc.id"
              @pointerdown="startArcDrag($event, arc, index)"
            >
              <button type="button" class="chapter-arc-pick" @click="pickArc(arc.id)">
                <span>{{ romanNumeral(index + 1) }}</span>
                <strong>{{ arc.name }}</strong>
                <small v-if="arc.id === currentArc?.id">сейчас здесь</small>
              </button>
              <button
                v-if="isDm"
                type="button"
                class="chapter-arc-edit"
                title="Редактировать арку"
                aria-label="Редактировать арку"
                :disabled="locked"
                @pointerdown.stop
                @click.stop="editArc(arc)"
              ><Pencil :size="14" /></button>
            </div>
            <button v-if="isDm" type="button" class="chapter-arc-create" :disabled="locked" @click="createArc">+ Новая арка</button>
          </div>
        </BasePopover>
      </div>
    </div>
  </div>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { Pencil } from '@lucide/vue'
import { BasePopover, reorderByDrop, useSortable } from '@sylvieshare/share-ui'
import { romanNumeral } from '../lib/chapterGraph'
import SessionStatusControl from './SessionStatusControl.vue'
const props = defineProps({
  session: Object, isDm: Boolean, locked: Boolean, reorderPending: Boolean,
  arcs: { type: Array, default: () => [] }, selectedArc: Object, currentArc: Object,
})
const emit = defineEmits(['edit-session', 'session-updated', 'select-arc', 'create-arc', 'edit-arc', 'reorder-arcs'])
const arcTrigger = ref(null)
const arcOpen = ref(false)
const arcItems = computed(() => props.arcs)
const canReorderArcs = computed(() => props.isDm && !props.locked && !props.reorderPending && props.arcs.length > 1)
const arcSortable = useSortable({
  groups: { arcs: { items: arcItems } },
  getKey: arc => arc.id,
  onDrop: ({ fromIndex, toIndex }) => {
    if (fromIndex === toIndex) return
    emit('reorder-arcs', reorderByDrop(props.arcs, fromIndex, toIndex).map(arc => arc.id))
  },
})
const displayedArcs = computed(() => arcSortable.displayItems('arcs'))

watch(() => props.locked, locked => {
  if (locked) arcOpen.value = false
})

function pickArc(id) {
  if (arcSortable.shouldSuppressClick()) return
  arcOpen.value = false
  emit('select-arc', id)
}

function startArcDrag(event, arc, index) {
  if (!canReorderArcs.value) return
  arcSortable.startDrag(event, arc, 'arcs', index)
}

function editArc(arc) {
  arcOpen.value = false
  emit('edit-arc', arc)
}

function createArc() {
  arcOpen.value = false
  emit('create-arc')
}

</script>
<style scoped>
.chapter-toolbar-left { min-width: 0; display: flex; align-items: center; gap: 10px; }
.chapter-session-context { min-width: 0; display: grid; gap: 3px; }
.chapter-toolbar-main { min-width: 0; display: flex; }
.chapter-session { min-width: 0; max-width: 100%; display: flex; align-items: center; gap: 4px; }
.chapter-session-title { min-width: 0; overflow: hidden; padding: 0; border: 0; border-radius: 6px; background: none; color: var(--text-1); font: inherit; font-family: var(--font-display); font-size: 20px; font-weight: 680; text-align: left; text-overflow: ellipsis; white-space: nowrap; }
.chapter-session-title:not(:disabled) { cursor: pointer; }
.chapter-session-title:not(:disabled):hover { background: color-mix(in srgb, var(--text-on-accent) 6%, transparent); }
.chapter-session-title:disabled { opacity: 1; }
.chapter-toolbar-rule { width: 1px; height: 22px; margin: 0 3px; background: var(--border-strong); }

.chapter-arc-trigger { min-width: 0; max-width: 100%; display: inline-flex; align-items: center; gap: 7px; padding: 3px 0; border: 0; border-radius: 7px; background: transparent; color: var(--text-1); font: inherit; font-size: 11px; font-weight: 700; cursor: pointer; transition: background 0.15s, color 0.15s; }
.chapter-arc-trigger:hover:not(:disabled), .chapter-arc-trigger[aria-expanded="true"] { background: color-mix(in srgb, var(--text-on-accent) 7%, transparent); }
.chapter-arc-trigger:disabled { opacity: 0.48; cursor: not-allowed; }
.chapter-arc-prefix { flex: none; color: var(--text-muted); font-size: 10px; font-weight: 800; letter-spacing: 0.1em; }
.chapter-arc-number { display: inline-flex; min-width: 20px; align-items: center; justify-content: center; color: var(--accent-soft); font-family: var(--font-ui); font-size: 13px; font-weight: 700; letter-spacing: 0.04em; line-height: 1; font-variant-numeric: tabular-nums; }
.chapter-arc-name { min-width: 0; flex: 0 1 auto; margin-left: -6px; overflow: hidden; text-align: left; text-overflow: ellipsis; white-space: nowrap; }
.chapter-arc-chevron { flex: none; transition: transform 0.15s; }
.chapter-arc-trigger[aria-expanded="true"] .chapter-arc-chevron { transform: rotate(180deg); }

.chapter-arc-list { display: flex; flex-direction: column; gap: 3px; padding: 5px; }
.chapter-arc-row { display: flex; align-items: center; gap: 4px; border-radius: 7px; }
.chapter-arc-row--sortable { cursor: grab; touch-action: none; }
.chapter-arc-row--sortable:active { cursor: grabbing; }
.chapter-arc-row--placeholder { opacity: 0.38; }
.chapter-arc-row.active { background: color-mix(in srgb, var(--accent) 12%, transparent); }
.chapter-arc-pick { min-width: 0; flex: 1; display: grid; grid-template-columns: 32px minmax(0, 1fr); align-items: center; gap: 6px; padding: 8px; border: 0; background: none; color: var(--text-2); font: inherit; text-align: left; cursor: pointer; }
.chapter-arc-pick > span { color: var(--accent-soft); font-family: var(--font-ui); font-size: 15px; font-weight: 700; letter-spacing: 0.04em; text-align: center; font-variant-numeric: tabular-nums; }
.chapter-arc-pick strong { overflow: hidden; color: var(--text-1); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.chapter-arc-pick small { grid-column: 2; color: var(--text-muted); font-size: 9px; }
.chapter-arc-edit { width: 28px; height: 28px; display: grid; flex: none; margin-right: 4px; place-items: center; border: 0; border-radius: 6px; background: none; color: var(--text-muted); cursor: pointer; }
.chapter-arc-edit:hover:not(:disabled) { background: var(--surface-raised); color: var(--text-1); }
.chapter-arc-edit:disabled { opacity: 0.3; cursor: not-allowed; }
.chapter-arc-create { margin-top: 3px; padding: 9px; border: 1px dashed color-mix(in srgb, var(--accent) 42%, transparent); border-radius: 7px; background: none; color: var(--accent-soft); font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; }

</style>
