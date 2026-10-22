<template>
  <WorkspaceHeader class="chapter-toolbar" @resize="emit('resize', $event)">
    <template #identity>
    <SessionBackButton />
    <SessionToolbarIdentity
      :session="session" :is-dm="isDm" :arcs="arcs" :selected-arc="selectedArc" :current-arc="currentArc"
      :locked="locked" :reorder-pending="reorderPending"
      @edit-session="emit('edit-session')" @session-updated="emit('session-updated', $event)"
      @select-arc="emit('select-arc', $event)" @create-arc="emit('create-arc')"
      @edit-arc="emit('edit-arc', $event)" @reorder-arcs="emit('reorder-arcs', $event)"
    />
    </template>
    <template #navigation><div class="chapter-toolbar-center">
      <IconNavigation data-tutorial="session-navigation" class="chapter-primary-nav"
        :items="navigationItems" :model-value="navigationKey" label="Раздел сессии" @select="selectView">
        <template #icon="{ item }">
          <component :is="item.icon" :size="24" :style="item.key === 'combat' && encounterActive && navigationKey !== 'combat' ? { color: 'var(--danger)' } : undefined" aria-hidden="true" />
        </template>
        <template #decoration="{ item }">
          <span v-if="item.key === 'combat' && encounterActive" class="chapter-combat-running-indicator" aria-hidden="true" />
          <kbd v-if="showShortcutHints && item.shortcut" class="chapter-shortcut-hint" aria-hidden="true">{{ item.key === 'combat' ? shortcutLabels.panel : shortcutLabels.alt }}+{{ item.shortcut }}</kbd>
        </template>
      </IconNavigation>


    </div>
    </template>
    <template #actions><slot name="tools" /><SessionToolbarMusic v-if="isDm" :primary-view="primaryView" :show-shortcut-hints="showShortcutHints" @select-view="emit('select-view', $event)" />
    </template>
  </WorkspaceHeader>
</template>

<script setup>
import { computed } from 'vue'
import { IconNavigation } from '@sylvieshare/share-ui'
import { sessionNavigationItems, selectedSessionNavigation } from '../lib/sessionNavigation'
import WorkspaceHeader from '@/shared/ui/WorkspaceHeader.vue'
import SessionToolbarIdentity from './SessionToolbarIdentity.vue'
import SessionBackButton from './SessionBackButton.vue'
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
const shortcutLabels = sessionShortcutLabels()
const navigationItems = computed(() => sessionNavigationItems(props))
const navigationKey = computed(() => selectedSessionNavigation(props.primaryView, props.combatActive))
function selectView(key) {
  key === 'combat' ? emit('open-combat') : emit('select-view', key)
}

</script>

<style scoped>
.chapter-toolbar-center { display: flex; align-items: center; justify-self: center; min-width: 0; max-width: 100%; }
.chapter-shortcut-hint {
  position: absolute;
  z-index: 2;
  top: 0;
  right: 0;
  padding: 2px 4px;
  border: 1px solid var(--border-strong);
  border-radius: 5px;
  background: var(--popover-bg);
  color: var(--text-1);
  font: 750 9px/1.25 var(--font-ui);
  white-space: nowrap;
  pointer-events: none;
  animation: chapter-shortcut-hint-in .16s ease both;
}
@keyframes chapter-shortcut-hint-in { from { opacity: 0; transform: translateY(-3px); } }
.chapter-combat-running-indicator {
  position: absolute; top: 4px; right: 4px; width: 6px; height: 6px;
  border: 1px solid var(--surface); border-radius: 50%; background: var(--danger);
  animation: chapter-combat-live 1.8s ease-in-out infinite;
}
@keyframes chapter-combat-live { 50% { box-shadow: 0 0 0 3px color-mix(in srgb, var(--danger) 18%, transparent); } }
@container (max-width: 1100px) {
  .chapter-toolbar-center { grid-row: 2; grid-column: 1 / -1; }
}
@media (max-width: 760px) { .chapter-toolbar-center { justify-self: stretch; } }
@media (prefers-reduced-motion: reduce) {
  .chapter-shortcut-hint, .chapter-combat-running-indicator { animation: none; }
}
</style>
