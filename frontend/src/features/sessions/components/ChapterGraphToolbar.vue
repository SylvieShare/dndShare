<template>
  <header ref="header" class="chapter-toolbar">
    <SessionToolbarIdentity
      :session="session" :is-dm="isDm" :arcs="arcs" :selected-arc="selectedArc" :current-arc="currentArc"
      :locked="locked" :reorder-pending="reorderPending"
      @edit-session="emit('edit-session')" @session-updated="emit('session-updated', $event)"
      @select-arc="emit('select-arc', $event)" @create-arc="emit('create-arc')"
      @edit-arc="emit('edit-arc', $event)" @reorder-arcs="emit('reorder-arcs', $event)"
    />
    <div class="chapter-toolbar-center">
      <nav data-tutorial="session-navigation" class="chapter-primary-nav" aria-label="Раздел сессии">
        <button
          type="button"
          class="chapter-primary-tab"
          :class="{ 'chapter-primary-tab--active': primaryView === storyView.key && !combatActive }"
          :aria-current="primaryView === storyView.key && !combatActive ? 'page' : undefined"
          :aria-keyshortcuts="`Alt+${storyView.shortcut}`"
          @click="emit('select-view', storyView.key)"
        >
          <component :is="storyView.icon" :size="24" />
          <span>{{ storyView.label }}</span>
          <kbd v-if="showShortcutHints" class="chapter-shortcut-hint" aria-hidden="true">{{ shortcutLabels.alt }}+{{ storyView.shortcut }}</kbd>
        </button>

        <button
          type="button"
          data-tutorial="session-combat"
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
          @click="emit('open-combat')"
        >
          <Swords :size="24" />
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
          @click="emit('select-view', view.key)"
        >
          <component :is="view.icon" :size="24" />
          <span>{{ view.label }}</span>
          <kbd v-if="showShortcutHints" class="chapter-shortcut-hint" aria-hidden="true">{{ shortcutLabels.alt }}+{{ view.shortcut }}</kbd>
        </button>

        <MapAvailabilityGate v-if="isDm" :disabled="!mapsAvailable">
        <button type="button" class="chapter-primary-tab" :class="{ 'chapter-primary-tab--active': mapsAvailable && primaryView === 'maps' }"
          :aria-disabled="!mapsAvailable || undefined"
          :aria-current="mapsAvailable && primaryView === 'maps' ? 'page' : undefined" @click="mapsAvailable && emit('select-view', 'maps')">
          <Map :size="24" /><span>Карта</span>
        </button>
        </MapAvailabilityGate>
        <span v-if="isDm" class="chapter-primary-divider" role="separator" aria-orientation="vertical" />


        <button
          v-if="isDm"
          type="button"
          class="chapter-primary-tab"
          :class="{ 'chapter-primary-tab--active': primaryView === journalView.key }"
          :aria-current="primaryView === journalView.key ? 'page' : undefined"
          :aria-keyshortcuts="`Alt+${journalView.shortcut}`"
          @click="emit('select-view', journalView.key)"
        >
          <NotebookPen :size="24" />
          <span>{{ journalView.label }}</span>
          <kbd v-if="showShortcutHints" class="chapter-shortcut-hint" aria-hidden="true">{{ shortcutLabels.alt }}+{{ journalView.shortcut }}</kbd>
        </button>

        <button
          v-if="isDm"
          type="button"
          class="chapter-primary-tab"
          :class="{ 'chapter-primary-tab--active': primaryView === chronicleView.key }"
          :aria-current="primaryView === chronicleView.key ? 'page' : undefined"
          :aria-keyshortcuts="`Alt+${chronicleView.shortcut}`"
          @click="emit('select-view', chronicleView.key)"
        >
          <History :size="24" />
          <span>{{ chronicleView.label }}</span>
          <kbd v-if="showShortcutHints" class="chapter-shortcut-hint" aria-hidden="true">{{ shortcutLabels.alt }}+{{ chronicleView.shortcut }}</kbd>
        </button>
        <button v-if="isDm" type="button" class="chapter-primary-tab"
          :class="{ 'chapter-primary-tab--active': primaryView === 'settings' }"
          :aria-current="primaryView === 'settings' ? 'page' : undefined"
          @click="emit('select-view', 'settings')">
          <Settings :size="24" /><span>Настройки</span>
        </button>
      </nav>


    </div>
    <SessionToolbarMusic v-if="isDm" :primary-view="primaryView" :show-shortcut-hints="showShortcutHints" @select-view="emit('select-view', $event)" />
  </header>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { BookOpenText, History, Images, Map, NotebookPen, ScrollText, Settings, Swords, UsersRound } from '@lucide/vue'
import SessionToolbarIdentity from './SessionToolbarIdentity.vue'
import MapAvailabilityGate from '@/features/maps/components/MapAvailabilityGate.vue'
import { useAccountStore } from '@/stores/account'
import SessionToolbarMusic from './SessionToolbarMusic.vue'
import { sessionShortcutLabels } from '@/features/sessions/lib/sessionShortcuts'

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
  showShortcutHints: { type: Boolean, default: false },
})
const emit = defineEmits([
  'select-arc', 'create-arc', 'edit-arc', 'reorder-arcs',
  'select-view', 'resize',
  'edit-session', 'session-updated', 'open-combat',
])
const header = ref(null)
const account = useAccountStore()
const mapsAvailable = computed(() => account.hasRole('ADMIN'))
let headerObserver
onMounted(() => {
  headerObserver = new ResizeObserver(() => emit('resize', header.value.getBoundingClientRect().height))
  headerObserver.observe(header.value)
})
onBeforeUnmount(() => headerObserver?.disconnect())
const primaryViews = [
  { key: 'story', label: 'Сюжет', icon: BookOpenText, shortcut: '1' },
  { key: 'locations', label: 'Локации', icon: Map, shortcut: '2' },
  { key: 'npcs', label: 'NPC', icon: UsersRound, shortcut: '3' },
  { key: 'quests', label: 'Задания', icon: ScrollText, shortcut: '4' },
  { key: 'materials', label: 'Материалы', icon: Images, shortcut: '5' },
]
const shortcutLabels = sessionShortcutLabels()
const storyView = primaryViews[0]
const journalView = { key: 'journal', label: 'Дневник', icon: NotebookPen, shortcut: '7' }
const chronicleView = { key: 'events', label: 'Хроника', icon: History, shortcut: '8' }
const combatButtonState = computed(() => `${props.combatActive ? 'open' : 'closed'}-${props.encounterActive ? 'running' : 'stopped'}`)
const combatButtonLabel = computed(() => `${props.combatActive ? 'Бой открыт' : 'Открыть бой'} · бой ${props.encounterActive ? 'идёт' : 'не запущен'}`)
const visibleLibraryViews = computed(() => props.isDm ? primaryViews.slice(1) : [])

</script>

<style scoped>
.chapter-toolbar {
  position: relative;
  z-index: 20;
  display: grid;
  grid-template-columns: minmax(150px, 1fr) auto minmax(142px, 1fr);
  align-items: center;
  gap: 12px;
  flex: none;
  min-height: 78px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}
.chapter-toolbar-center { display: flex; align-items: center; justify-self: center; min-width: 0; gap: 14px; }
.chapter-primary-nav { display: flex; align-items: center; gap: 2px; }
.chapter-primary-tab {
  position: relative;
  display: inline-flex;
  min-height: 54px;
  min-width: 48px;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 5px;
  padding: 5px 7px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 10px;
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
.chapter-primary-tab:hover:not(:disabled) { color: var(--text-1); }
.chapter-primary-tab--active { color: var(--text-1); }
.chapter-primary-tab--active::after { opacity: 1; transform: scaleX(1); }
.chapter-primary-divider { width: 1px; height: 21px; flex: none; margin: 0 5px; background: var(--border-strong); }
.chapter-primary-tab--combat { color: color-mix(in srgb, var(--danger) 62%, var(--text-muted)); }
.chapter-primary-tab--encounter-active { color: var(--danger); }
.chapter-primary-tab--combat.chapter-primary-tab--active.chapter-primary-tab--encounter-active { color: var(--danger); }
.chapter-combat-running-indicator { position: absolute; top: 3px; right: 3px; width: 6px; height: 6px; border: 1px solid var(--bg); border-radius: 50%; background: var(--danger); opacity: 0; transform: scale(.55); transition: opacity .15s, transform .15s; }
.chapter-primary-tab--encounter-active .chapter-combat-running-indicator { opacity: 1; transform: scale(1); animation: chapter-combat-live 1.8s ease-in-out infinite; }
@keyframes chapter-combat-live { 50% { box-shadow: 0 0 0 3px color-mix(in srgb, var(--danger) 18%, transparent); } }
.chapter-primary-tab:disabled { cursor: not-allowed; opacity: 0.45; }

@container (max-width: 1100px) {
  .chapter-toolbar { grid-template-columns: minmax(0, 1fr) auto; gap: 8px 14px; }
  .chapter-toolbar-center { grid-row: 2; grid-column: 1 / -1; max-width: 100%; overflow-x: auto; }
}
@media (max-width: 760px) {
  .chapter-toolbar { padding: 8px 12px; }
  .chapter-toolbar-center { justify-self: stretch; }
  .chapter-primary-tab { flex: none; }
}
@media (prefers-reduced-motion: reduce) {
  .chapter-shortcut-hint { animation: none; }
  .chapter-primary-tab--encounter-active .chapter-combat-running-indicator { animation: none; }
}
</style>
