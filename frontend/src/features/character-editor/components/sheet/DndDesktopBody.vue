<template>
  <div class="dnd-desktop-body">
    <aside class="dnd-desktop-stats"><DndStats format="desktop" /></aside>
    <main class="dnd-desktop-main">
      <DndIdentityCard />
      <SlidingTabs data-tutorial="character-tabs" :tabs="tabs" :model-value="section" @update:model-value="emit('select-tab', $event)" />
      <div class="inner-tabs-content">
        <section v-for="id in visited" :key="id" v-show="id === section" :inert="id !== section" class="inner-tab-pane">
          <DndSection :section="id" format="desktop" />
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
import { computed, ref, watch } from 'vue'
import { SlidingTabs } from '@sylvieshare/share-ui'
import CharacterBlock from '../CharacterBlock.vue'
import DndStats from './DndStats.vue'
import DndIdentityCard from './DndIdentityCard.vue'
import DndUtilities from './DndUtilities.vue'
import DndSection from './DndSection.vue'
import definition from '../../settings/dnd/definition'
const props = defineProps({ section: String })
const emit = defineEmits(['select-tab'])
const visited = ref([])
watch(() => props.section, id => { if (id && !visited.value.includes(id)) visited.value.push(id) }, { immediate: true })
const tabs = computed(() => definition.tabs.desktop.map(tab => ({ key: tab.id, title: tab.title })))
</script>
<style scoped>
.dnd-desktop-body { display: grid; grid-template-columns: var(--layout-sheet-stats-column) minmax(0, 1fr) var(--layout-sheet-utilities-column); gap: 15px; }
.dnd-desktop-stats, .dnd-desktop-utilities { padding: 20px; min-width: 0; }
.dnd-desktop-main { min-width: 0; display: flex; flex-direction: column; gap: 11px; }
.dnd-desktop-utilities { gap: 15px; }
.inner-tabs-content { padding-top: 3px; min-width: 0; }
.inner-tab-pane { animation: sheet-section-in var(--motion-navigation); }
@keyframes sheet-section-in { from { opacity: 0; transform: translateY(6px); } }
@media (prefers-reduced-motion: reduce) { .inner-tab-pane { animation: none; } }
</style>
