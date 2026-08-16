<template>
  <header class="chapter-toolbar">
    <div class="chapter-toolbar-left">
      <div v-if="session" class="chapter-session">
        <button
          type="button"
          class="chapter-session-title"
          :disabled="!isDm"
          :title="isDm ? 'Редактировать сессию' : session.name"
          @click="$emit('edit-session')"
        >{{ session.name }}</button>
      </div>

      <span v-if="session && primaryView === 'story'" class="chapter-toolbar-rule chapter-toolbar-rule--session" />

      <div v-if="primaryView === 'story'" class="chapter-toolbar-main">
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

    <nav class="chapter-primary-nav" aria-label="Раздел сессии">
      <button
        v-for="view in visiblePrimaryViews"
        :key="view.key"
        type="button"
        class="chapter-primary-tab"
        :class="{ 'chapter-primary-tab--active': primaryView === view.key }"
        :aria-current="primaryView === view.key ? 'page' : undefined"
        :disabled="locked"
        @click="$emit('select-view', view.key)"
      >
        <component :is="view.icon" :size="14" />
        <span>{{ view.label }}</span>
      </button>
    </nav>

    <div class="chapter-toolbar-view">
      <SessionPresentationControl
        v-if="isDm && presentation && materials"
        :session-uuid="sessionUuid"
        :is-dm="isDm"
        :presentation="presentation"
        :materials="materials"
        :chapter-id="workspaceChapterId"
        :scene="workspaceScene"
      />
      <button type="button" class="chapter-tool-btn chapter-tool-btn--icon chapter-tool-btn--combat" :class="{ 'chapter-tool-btn--active': combatActive }" title="Бой" aria-label="Бой" @click="$emit('open-combat')">
        <Swords :size="19" />
      </button>

      <span class="chapter-toolbar-rule" />

      <div class="chapter-panel-tools" aria-label="Панели сессии">
        <button type="button" class="chapter-tool-btn chapter-tool-btn--icon" :class="{ 'chapter-tool-btn--active': diceOpen }" title="Кубики" aria-label="Кубики" :aria-pressed="diceOpen" @click="$emit('toggle-dice')">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.8l5.3 3v6.4L8 14.2l-5.3-3V4.8L8 1.8zM2.9 4.9L8 8l5.1-3.1M8 8v6" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
        </button>
        <button type="button" class="chapter-tool-btn chapter-tool-btn--icon" :class="{ 'chapter-tool-btn--active': musicOpen }" title="Музыка" aria-label="Музыка" :aria-pressed="musicOpen" @click="$emit('toggle-music')">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 12.5V3.8l6-1.3v8.2M6 12.5a1.8 1.8 0 1 1-1.8-1.8A1.8 1.8 0 0 1 6 12.5zm6-1.8a1.8 1.8 0 1 1-1.8-1.8A1.8 1.8 0 0 1 12 10.7z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button type="button" class="chapter-tool-btn chapter-tool-btn--icon" :class="{ 'chapter-tool-btn--active': eventsOpen }" title="Лог сессии" aria-label="Лог сессии" :aria-pressed="eventsOpen" @click="$emit('toggle-events')">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 2.5h10v11H3zM5.5 5.5h5M5.5 8h5M5.5 10.5h3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        </button>
      </div>
      <SessionSettingsControl
        v-if="isDm"
        :hide-canvas-legend="settings.hideCanvasLegend"
        :auto-roll-npc-hp="settings.autoRollNpcHp"
        @update-setting="(...args) => $emit('update-setting', ...args)"
      />
    </div>
  </header>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { BookOpenText, Images, Map, Pencil, Swords, UsersRound } from '@lucide/vue'
import { BasePopover, reorderByDrop, useSortable } from '@sylvieshare/share-ui'
import { romanNumeral } from '@/features/sessions/lib/chapterGraph'
import SessionPresentationControl from '@/features/sessions/components/SessionPresentationControl.vue'
import SessionSettingsControl from '@/features/sessions/components/SessionSettingsControl.vue'

const props = defineProps({
  arcs: { type: Array, default: () => [] },
  selectedArc: { type: Object, default: null },
  currentArc: { type: Object, default: null },
  session: { type: Object, default: null },
  isDm: { type: Boolean, default: false },
  locked: { type: Boolean, default: false },
  primaryView: { type: String, default: 'story' },
  reorderPending: { type: Boolean, default: false },
  combatActive: { type: Boolean, default: false },
  diceOpen: { type: Boolean, default: true },
  musicOpen: { type: Boolean, default: true },
  eventsOpen: { type: Boolean, default: true },
  sessionUuid: { type: String, required: true },
  presentation: { type: Object, default: null },
  materials: { type: Object, default: null },
  workspaceChapterId: { type: [Number, String], default: null },
  workspaceScene: { type: Object, default: null },
  settings: { type: Object, default: () => ({ hideCanvasLegend: false, autoRollNpcHp: false }) },
})
const emit = defineEmits([
  'select-arc', 'create-arc', 'edit-arc', 'reorder-arcs',
  'select-view',
  'edit-session', 'open-combat',
  'toggle-dice', 'toggle-music', 'toggle-events',
  'update-setting',
])
const primaryViews = [
  { key: 'story', label: 'Сюжет', icon: BookOpenText },
  { key: 'locations', label: 'Локации', icon: Map },
  { key: 'npcs', label: 'NPC', icon: UsersRound },
  { key: 'materials', label: 'Материалы', icon: Images },
]
const visiblePrimaryViews = computed(() => props.isDm ? primaryViews : primaryViews.slice(0, 1))
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
.chapter-toolbar {
  position: relative;
  z-index: 20;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  flex: none;
  padding: 11px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}
.chapter-toolbar-left { min-width: 0; display: flex; align-items: center; gap: 12px; }
.chapter-toolbar-main,
.chapter-toolbar-view { display: flex; align-items: center; gap: 7px; min-width: 0; }
.chapter-toolbar-view { justify-self: end; }
.chapter-primary-nav { display: flex; align-items: center; justify-self: center; gap: 2px; }
.chapter-primary-tab {
  position: relative;
  display: inline-flex;
  min-height: 31px;
  align-items: center;
  gap: 6px;
  padding: 6px 9px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.chapter-primary-tab::after {
  position: absolute;
  right: 9px;
  bottom: 2px;
  left: 9px;
  height: 2px;
  border-radius: 2px;
  background: var(--accent);
  content: '';
  opacity: 0;
  transform: scaleX(0.45);
  transition: opacity 0.15s, transform 0.15s;
}
.chapter-primary-tab:hover:not(:disabled) { background: color-mix(in srgb, var(--text-on-accent) 6%, transparent); color: var(--text-1); }
.chapter-primary-tab--active { color: var(--text-1); }
.chapter-primary-tab--active::after { opacity: 1; transform: scaleX(1); }
.chapter-primary-tab:disabled { cursor: not-allowed; opacity: 0.45; }
.chapter-panel-tools { display: flex; align-items: center; gap: 7px; }
.chapter-session { min-width: 0; max-width: 300px; display: flex; align-items: center; gap: 4px; }
.chapter-session-title { min-width: 0; overflow: hidden; padding: 4px 6px; border: 0; border-radius: 6px; background: none; color: var(--text-1); font: inherit; font-family: var(--font-display); font-size: 21px; font-weight: 680; text-align: left; text-overflow: ellipsis; white-space: nowrap; }
.chapter-session-title:not(:disabled) { cursor: pointer; }
.chapter-session-title:not(:disabled):hover { background: color-mix(in srgb, var(--text-on-accent) 6%, transparent); }
.chapter-session-title:disabled { opacity: 1; }
.chapter-toolbar-rule { width: 1px; height: 22px; margin: 0 3px; background: var(--border-strong); }

.chapter-tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: 1px solid var(--border-strong);
  border-radius: 7px;
  background: color-mix(in srgb, var(--text-on-accent) 4%, transparent);
  color: var(--text-2);
  font: inherit;
  font-size: 12px;
}
.chapter-arc-trigger { min-width: 0; max-width: 410px; display: inline-flex; align-items: center; gap: 7px; padding: 7px 9px; border: 0; border-radius: 7px; background: transparent; color: var(--text-1); font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; transition: background 0.15s, color 0.15s; }
.chapter-arc-trigger:hover:not(:disabled), .chapter-arc-trigger[aria-expanded="true"] { background: color-mix(in srgb, var(--text-on-accent) 7%, transparent); }
.chapter-arc-trigger:disabled { opacity: 0.48; cursor: not-allowed; }
.chapter-arc-prefix { flex: none; color: var(--text-muted); font-size: 10px; font-weight: 800; letter-spacing: 0.1em; }
.chapter-arc-number { display: inline-flex; min-width: 20px; align-items: center; justify-content: center; color: var(--accent-soft); font-family: var(--font-display); font-size: 17px; font-weight: 700; letter-spacing: 0.04em; line-height: 1; }
.chapter-arc-name { min-width: 0; flex: 0 1 auto; margin-left: -6px; overflow: hidden; text-align: left; text-overflow: ellipsis; white-space: nowrap; }
.chapter-arc-chevron { flex: none; transition: transform 0.15s; }
.chapter-arc-trigger[aria-expanded="true"] .chapter-arc-chevron { transform: rotate(180deg); }

.chapter-tool-btn { padding: 7px 10px; cursor: pointer; transition: background 0.15s, color 0.15s; }
.chapter-tool-btn:hover:not(:disabled) { background: color-mix(in srgb, var(--text-on-accent) 9%, transparent); color: var(--text-1); }
.chapter-tool-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.chapter-tool-btn--icon { width: 31px; height: 31px; justify-content: center; padding: 0; }
.chapter-tool-btn--combat { border-color: color-mix(in srgb, var(--danger) 38%, transparent); color: color-mix(in srgb, var(--danger) 84%, var(--text-1)); font-weight: 700; }
.chapter-tool-btn--combat.chapter-tool-btn--active { background: color-mix(in srgb, var(--danger) 18%, transparent); border-color: color-mix(in srgb, var(--danger) 66%, transparent); color: var(--danger); }
.chapter-tool-btn--active:not(.chapter-tool-btn--combat) { background: color-mix(in srgb, var(--accent) 16%, transparent); border-color: color-mix(in srgb, var(--accent) 55%, var(--border)); color: var(--text-1); }

.chapter-arc-list { display: flex; flex-direction: column; gap: 3px; padding: 5px; }
.chapter-arc-row { display: flex; align-items: center; gap: 4px; border-radius: 7px; }
.chapter-arc-row--sortable { cursor: grab; touch-action: none; }
.chapter-arc-row--sortable:active { cursor: grabbing; }
.chapter-arc-row--placeholder { opacity: 0.38; }
.chapter-arc-row.active { background: color-mix(in srgb, var(--accent) 12%, transparent); }
.chapter-arc-pick { min-width: 0; flex: 1; display: grid; grid-template-columns: 32px minmax(0, 1fr); align-items: center; gap: 6px; padding: 8px; border: 0; background: none; color: var(--text-2); font: inherit; text-align: left; cursor: pointer; }
.chapter-arc-pick > span { color: var(--accent-soft); font-family: var(--font-display); font-size: 15px; font-weight: 700; letter-spacing: 0.04em; text-align: center; }
.chapter-arc-pick strong { overflow: hidden; color: var(--text-1); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.chapter-arc-pick small { grid-column: 2; color: var(--text-muted); font-size: 9px; }
.chapter-arc-edit { width: 28px; height: 28px; display: grid; flex: none; margin-right: 4px; place-items: center; border: 0; border-radius: 6px; background: none; color: var(--text-muted); cursor: pointer; }
.chapter-arc-edit:hover:not(:disabled) { background: var(--surface-raised); color: var(--text-1); }
.chapter-arc-edit:disabled { opacity: 0.3; cursor: not-allowed; }
.chapter-arc-create { margin-top: 3px; padding: 9px; border: 1px dashed color-mix(in srgb, var(--accent) 42%, transparent); border-radius: 7px; background: none; color: var(--accent-soft); font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; }

@media (max-width: 760px) {
  .chapter-toolbar { grid-template-columns: 1fr; align-items: stretch; }
  .chapter-toolbar-left { flex-wrap: wrap; }
  .chapter-toolbar-view { width: 100%; justify-self: stretch; }
  .chapter-arc-trigger { min-width: 0; }
  .chapter-session { max-width: none; }
  .chapter-toolbar-rule { display: none; }
  .chapter-primary-nav { width: 100%; justify-self: stretch; overflow-x: auto; }
}
</style>
