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
        type="button"
        class="chapter-primary-tab"
        :class="{ 'chapter-primary-tab--active': primaryView === storyView.key && !combatActive }"
        :aria-current="primaryView === storyView.key && !combatActive ? 'page' : undefined"
        :aria-keyshortcuts="`Alt+${storyView.shortcut}`"
        @click="$emit('select-view', storyView.key)"
      >
        <component :is="storyView.icon" :size="14" />
        <span>{{ storyView.label }}</span>
        <kbd v-if="showShortcutHints" class="chapter-shortcut-hint" aria-hidden="true">{{ shortcutLabels.alt }}+{{ storyView.shortcut }}</kbd>
      </button>

      <button
        type="button"
        class="chapter-primary-tab chapter-primary-tab--combat"
        :class="{
          'chapter-primary-tab--active': combatActive,
          'chapter-primary-tab--encounter-active': encounterActive,
        }"
        :data-combat-state="combatButtonState"
        :title="combatButtonLabel"
        :aria-label="combatButtonLabel"
        :aria-current="combatActive ? 'page' : undefined"
        aria-keyshortcuts="Shift+B"
        @click="$emit('open-combat')"
      >
        <Swords :size="14" />
        <span>Бой</span>
        <span class="chapter-combat-running-indicator" aria-hidden="true" />
        <kbd v-if="showShortcutHints" class="chapter-shortcut-hint" aria-hidden="true">{{ shortcutLabels.panel }}+B</kbd>
      </button>

      <span v-if="visibleLibraryViews.length" class="chapter-primary-divider" role="separator" aria-orientation="vertical" />

      <button
        v-for="view in visibleLibraryViews"
        :key="view.key"
        type="button"
        class="chapter-primary-tab"
        :class="{ 'chapter-primary-tab--active': primaryView === view.key }"
        :aria-current="primaryView === view.key ? 'page' : undefined"
        :aria-keyshortcuts="`Alt+${view.shortcut}`"
        @click="$emit('select-view', view.key)"
      >
        <component :is="view.icon" :size="14" />
        <span>{{ view.label }}</span>
        <kbd v-if="showShortcutHints" class="chapter-shortcut-hint" aria-hidden="true">{{ shortcutLabels.alt }}+{{ view.shortcut }}</kbd>
      </button>

      <span v-if="isDm" class="chapter-primary-divider" role="separator" aria-orientation="vertical" />

      <div
        v-if="isDm"
        class="chapter-music-tab"
        :class="{
          'chapter-music-tab--active': primaryView === musicView.key,
          'chapter-music-tab--playing': musicState.playing,
        }"
        role="group"
        :aria-label="musicTabTitle"
      >
        <button
          type="button"
          class="chapter-primary-tab chapter-primary-tab--music"
          :title="musicTabTitle"
          :aria-current="primaryView === musicView.key ? 'page' : undefined"
          :aria-keyshortcuts="`Alt+${musicView.shortcut}`"
          @click="$emit('select-view', musicView.key)"
        >
          <Music2 :size="14" />
          <span>{{ musicView.label }}</span>
          <span v-if="currentMusicTrack" class="chapter-music-state" aria-hidden="true" />
          <kbd v-if="showShortcutHints" class="chapter-shortcut-hint" aria-hidden="true">{{ shortcutLabels.alt }}+{{ musicView.shortcut }}</kbd>
        </button>
        <div v-if="currentMusicTrack" class="chapter-music-controls">
          <button
            type="button"
            class="chapter-music-control"
            :title="musicState.playing ? 'Поставить музыку на паузу' : 'Продолжить музыку'"
            :aria-label="musicState.playing ? 'Поставить музыку на паузу' : 'Продолжить музыку'"
            @click="toggleMusicPlayback"
          >
            <Pause v-if="musicState.playing" :size="13" fill="currentColor" />
            <Play v-else :size="13" fill="currentColor" />
          </button>
          <button
            type="button"
            class="chapter-music-control"
            title="Следующий трек"
            aria-label="Следующий трек"
            :disabled="!playbackNextTrack"
            @click="musicStore.playNext()"
          >
            <SkipForward :size="14" fill="currentColor" />
          </button>
        </div>
        <span v-if="currentMusicTrack" class="chapter-music-progress" aria-hidden="true">
          <span :style="{ width: `${musicProgressPct}%` }" />
        </span>
      </div>

      <button
        v-if="isDm"
        type="button"
        class="chapter-primary-tab"
        :class="{ 'chapter-primary-tab--active': primaryView === chronicleView.key }"
        :aria-current="primaryView === chronicleView.key ? 'page' : undefined"
        :aria-keyshortcuts="`Alt+${chronicleView.shortcut}`"
        @click="$emit('select-view', chronicleView.key)"
      >
        <History :size="14" />
        <span>{{ chronicleView.label }}</span>
        <kbd v-if="showShortcutHints" class="chapter-shortcut-hint" aria-hidden="true">{{ shortcutLabels.alt }}+{{ chronicleView.shortcut }}</kbd>
      </button>
    </nav>

    <div class="chapter-toolbar-view">
      <SessionPresentationControl
        v-if="isDm && presentation"
        :session-uuid="sessionUuid"
        :is-dm="isDm"
        :presentation="presentation"
      />
      <SessionTimerControl v-if="isDm && timers" :timers="timers" />
      <SessionDiceControl v-if="isDm" ref="diceControl" :show-shortcut-hints="showShortcutHints" />
      <span v-if="isDm" class="chapter-toolbar-rule chapter-toolbar-rule--settings" />
      <SessionSettingsControl
        v-if="isDm"
        :auto-roll-npc-hp="settings.autoRollNpcHp"
        @update-setting="(...args) => $emit('update-setting', ...args)"
      />
    </div>
  </header>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { BookOpenText, History, Images, Map, Music2, Pause, Pencil, Play, ScrollText, SkipForward, Swords, UsersRound } from '@lucide/vue'
import { BasePopover, reorderByDrop, useSortable } from '@sylvieshare/share-ui'
import { romanNumeral } from '@/features/sessions/lib/chapterGraph'
import SessionPresentationControl from '@/features/sessions/components/SessionPresentationControl.vue'
import SessionDiceControl from '@/features/sessions/components/SessionDiceControl.vue'
import SessionSettingsControl from '@/features/sessions/components/SessionSettingsControl.vue'
import SessionTimerControl from '@/features/sessions/components/SessionTimerControl.vue'
import { sessionShortcutLabels } from '@/features/sessions/lib/sessionShortcuts'
import { useMusicStore } from '@/stores/music'

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
  encounterActive: { type: Boolean, default: false },
  sessionUuid: { type: String, required: true },
  presentation: { type: Object, default: null },
  timers: { type: Object, default: null },
  materials: { type: Object, default: null },
  workspaceChapterId: { type: [Number, String], default: null },
  workspaceScene: { type: Object, default: null },
  settings: { type: Object, default: () => ({ autoRollNpcHp: false }) },
  showShortcutHints: { type: Boolean, default: false },
})
const emit = defineEmits([
  'select-arc', 'create-arc', 'edit-arc', 'reorder-arcs',
  'select-view',
  'edit-session', 'open-combat',
  'update-setting',
])
const primaryViews = [
  { key: 'story', label: 'Сюжет', icon: BookOpenText, shortcut: '1' },
  { key: 'locations', label: 'Локации', icon: Map, shortcut: '2' },
  { key: 'npcs', label: 'NPC', icon: UsersRound, shortcut: '3' },
  { key: 'quests', label: 'Задания', icon: ScrollText, shortcut: '4' },
  { key: 'materials', label: 'Материалы', icon: Images, shortcut: '5' },
]
const shortcutLabels = sessionShortcutLabels()
const storyView = primaryViews[0]
const musicView = { key: 'music', label: 'Музыка', icon: Music2, shortcut: '6' }
const chronicleView = { key: 'events', label: 'Хроника', icon: History, shortcut: '7' }
const diceControl = ref(null)
const musicStore = useMusicStore()
const {
  state: musicState,
  currentTrack: currentMusicTrack,
  playbackNextTrack,
  remotePlayback,
} = storeToRefs(musicStore)
const musicProgressPct = computed(() => musicState.value.durationSec
  ? Math.min(100, Math.max(0, musicState.value.positionSec / musicState.value.durationSec * 100))
  : 0)
const musicTabTitle = computed(() => {
  if (!currentMusicTrack.value) return 'Музыка'
  const status = musicState.value.playing
    ? remotePlayback.value ? 'НА ЭКРАНЕ' : 'ИГРАЕТ'
    : 'ПАУЗА'
  return `${currentMusicTrack.value.name} · ${status}`
})
const combatButtonState = computed(() => `${props.combatActive ? 'open' : 'closed'}-${props.encounterActive ? 'running' : 'stopped'}`)
const combatButtonLabel = computed(() => `${props.combatActive ? 'Бой открыт' : 'Открыть бой'} · бой ${props.encounterActive ? 'идёт' : 'не запущен'}`)
const visibleLibraryViews = computed(() => props.isDm ? primaryViews.slice(1) : [])
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

function toggleMusicPlayback() {
  if (!currentMusicTrack.value) return
  if (musicState.value.playing) musicStore.pause()
  else musicStore.resume()
}

defineExpose({
  toggleDice: () => diceControl.value?.toggle(),
  rollDie: sides => diceControl.value?.rollDie(sides),
})
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
.chapter-shortcut-hint {
  position: absolute;
  z-index: 24;
  top: calc(100% + 5px);
  left: 50%;
  padding: 2px 5px;
  border: 1px solid color-mix(in srgb, var(--accent) 32%, var(--border));
  border-radius: 5px;
  background: color-mix(in srgb, var(--popover-bg) 94%, transparent);
  color: var(--text-1);
  font: 750 9px/1.25 var(--font-ui);
  white-space: nowrap;
  pointer-events: none;
  box-shadow: 0 4px 14px color-mix(in srgb, var(--scrim) 46%, transparent);
  transform: translateX(-50%);
  animation: chapter-shortcut-hint-in .16s cubic-bezier(.22, 1, .36, 1) both;
}
@keyframes chapter-shortcut-hint-in {
  from { opacity: 0; transform: translate(-50%, -3px); }
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
.chapter-music-tab {
  position: relative;
  display: inline-flex;
  align-items: stretch;
  overflow: hidden;
  border-radius: 7px;
  transition: background 0.15s, color 0.15s;
}
.chapter-music-tab--active { background: color-mix(in srgb, var(--accent) 10%, transparent); }
.chapter-primary-tab--music::after { display: none; }
.chapter-music-state {
  width: 5px;
  height: 5px;
  flex: none;
  border-radius: 50%;
  background: var(--accent);
  opacity: 0.62;
}
.chapter-music-tab--playing .chapter-music-state {
  opacity: 1;
  animation: chapter-music-live 1.8s ease-in-out infinite;
}
.chapter-music-controls { display: inline-flex; align-items: center; padding-right: 3px; }
.chapter-music-control {
  width: 25px;
  height: 25px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-left: 1px solid color-mix(in srgb, var(--border-strong) 70%, transparent);
  background: transparent;
  color: var(--text-2);
  cursor: pointer;
  transition: background 0.15s, color 0.15s, opacity 0.15s;
}
.chapter-music-control:hover:not(:disabled) { background: color-mix(in srgb, var(--text-on-accent) 8%, transparent); color: var(--text-1); }
.chapter-music-control:disabled { cursor: not-allowed; opacity: 0.28; }
.chapter-music-progress {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 2px;
  overflow: hidden;
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  pointer-events: none;
}
.chapter-music-progress > span {
  display: block;
  height: 100%;
  border-radius: 0 2px 2px 0;
  background: var(--accent);
  transition: width 0.45s linear;
}
@keyframes chapter-music-live { 50% { box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent); } }
.chapter-primary-divider { width: 1px; height: 21px; flex: none; margin: 0 5px; background: var(--border-strong); }
.chapter-primary-tab--combat { color: color-mix(in srgb, var(--danger) 62%, var(--text-muted)); }
.chapter-primary-tab--encounter-active { background: color-mix(in srgb, var(--danger) 9%, transparent); color: var(--danger); }
.chapter-primary-tab--combat.chapter-primary-tab--active.chapter-primary-tab--encounter-active { background: color-mix(in srgb, var(--danger) 13%, transparent); color: var(--danger); }
.chapter-combat-running-indicator { position: absolute; top: 3px; right: 3px; width: 6px; height: 6px; border: 1px solid var(--bg); border-radius: 50%; background: var(--danger); opacity: 0; transform: scale(.55); transition: opacity .15s, transform .15s; }
.chapter-primary-tab--encounter-active .chapter-combat-running-indicator { opacity: 1; transform: scale(1); animation: chapter-combat-live 1.8s ease-in-out infinite; }
@keyframes chapter-combat-live { 50% { box-shadow: 0 0 0 3px color-mix(in srgb, var(--danger) 18%, transparent); } }
.chapter-primary-tab:disabled { cursor: not-allowed; opacity: 0.45; }
.chapter-session { min-width: 0; max-width: 300px; display: flex; align-items: center; gap: 4px; }
.chapter-session-title { min-width: 0; overflow: hidden; padding: 4px 6px; border: 0; border-radius: 6px; background: none; color: var(--text-1); font: inherit; font-family: var(--font-display); font-size: 21px; font-weight: 680; text-align: left; text-overflow: ellipsis; white-space: nowrap; }
.chapter-session-title:not(:disabled) { cursor: pointer; }
.chapter-session-title:not(:disabled):hover { background: color-mix(in srgb, var(--text-on-accent) 6%, transparent); }
.chapter-session-title:disabled { opacity: 1; }
.chapter-toolbar-rule { width: 1px; height: 22px; margin: 0 3px; background: var(--border-strong); }

.chapter-arc-trigger { min-width: 0; max-width: 410px; display: inline-flex; align-items: center; gap: 7px; padding: 7px 9px; border: 0; border-radius: 7px; background: transparent; color: var(--text-1); font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; transition: background 0.15s, color 0.15s; }
.chapter-arc-trigger:hover:not(:disabled), .chapter-arc-trigger[aria-expanded="true"] { background: color-mix(in srgb, var(--text-on-accent) 7%, transparent); }
.chapter-arc-trigger:disabled { opacity: 0.48; cursor: not-allowed; }
.chapter-arc-prefix { flex: none; color: var(--text-muted); font-size: 10px; font-weight: 800; letter-spacing: 0.1em; }
.chapter-arc-number { display: inline-flex; min-width: 20px; align-items: center; justify-content: center; color: var(--accent-soft); font-family: var(--font-ui); font-size: 17px; font-weight: 700; letter-spacing: 0.04em; line-height: 1; font-variant-numeric: tabular-nums; }
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

@media (max-width: 760px) {
  .chapter-toolbar { grid-template-columns: 1fr; align-items: stretch; }
  .chapter-toolbar-left { flex-wrap: wrap; }
  .chapter-toolbar-view { width: 100%; justify-self: stretch; }
  .chapter-arc-trigger { min-width: 0; }
  .chapter-session { max-width: none; }
  .chapter-toolbar-rule { display: none; }
  .chapter-primary-nav { width: 100%; justify-self: stretch; overflow-x: auto; }
}
@media (prefers-reduced-motion: reduce) {
  .chapter-shortcut-hint { animation: none; }
  .chapter-primary-tab--encounter-active .chapter-combat-running-indicator { animation: none; }
  .chapter-music-tab--playing .chapter-music-state { animation: none; }
}
</style>
