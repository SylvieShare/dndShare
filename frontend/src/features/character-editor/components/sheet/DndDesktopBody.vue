<template>
  <div class="dnd-desktop-body">
    <aside class="dnd-desktop-stats"><DndStats format="desktop" /></aside>
    <main class="dnd-desktop-main">
      <DndIdentityCard />
      <SlidingTabs data-tutorial="character-tabs" :tabs="tabs" :model-value="section" @update:model-value="emit('select-tab', $event)" />
      <div class="inner-tabs-content">
        <section v-for="(tab, index) in tabs" :key="tab.key" v-show="tab.key === section" :inert="tab.key !== section" class="inner-tab-pane">
          <DndSection v-if="isReady(index)" :section="tab.key" format="desktop" />
          <CharacterSheetSkeleton v-else />
        </section>
      </div>
    </main>
    <aside class="dnd-desktop-utilities sheet-stack">
      <DndUtilities />
      <CharacterBlock block-id="feature_widgets" />
      <CharacterBlock block-id="actions" />
      <CharacterBlock block-id="resources" />
      <CharacterBlock block-id="defenses" />
      <CharacterBlock block-id="proficiencies" />
    </aside>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import { usePreparedTabs } from '../../composables/usePreparedTabs'
import CharacterSheetSkeleton from './CharacterSheetSkeleton.vue'
import { SlidingTabs } from '@sylvieshare/share-ui'
import CharacterBlock from '../CharacterBlock.vue'
import DndStats from './DndStats.vue'
import DndIdentityCard from './DndIdentityCard.vue'
import DndUtilities from './DndUtilities.vue'
import DndSection from './DndSection.vue'
import definition from '../../settings/dnd/definition'
const props = defineProps({ section: String })
const emit = defineEmits(['select-tab'])
const tabs = computed(() => definition.tabs.desktop.map(tab => ({ id: tab.id, key: tab.id, title: tab.title })))
const { isReady } = usePreparedTabs(tabs, computed(() => tabs.value.findIndex(tab => tab.key === props.section)), computed(() => false))

</script>
<style scoped>
.dnd-desktop-body { display: flex; align-items: flex-start; gap: 15px; }
.dnd-desktop-stats { flex: 0 1 var(--layout-sheet-stats-column); min-width: var(--layout-sheet-stats-column-min); }
.dnd-desktop-utilities { flex: 0 1 var(--layout-sheet-utilities-column); min-width: var(--layout-sheet-utilities-column-min); }
.dnd-desktop-stats, .dnd-desktop-utilities { padding: 20px; }
.dnd-desktop-main { flex: 1 1 calc(var(--layout-sheet-max) - var(--layout-sheet-stats-column) - var(--layout-sheet-utilities-column) - 30px); min-width: 0; display: flex; flex-direction: column; gap: 11px; }
.dnd-desktop-utilities { gap: 15px; }
.inner-tabs-content { padding-top: 3px; min-width: 0; }
.inner-tab-pane { animation: sheet-section-in var(--motion-navigation); }
@keyframes sheet-section-in { from { opacity: 0; transform: translateY(6px); } }
@media (prefers-reduced-motion: reduce) { .inner-tab-pane { animation: none; } }
</style>
