<template>
  <div class="sheet-stack dnd-section" :data-sheet-section="section">
    <CharacterBlock v-if="format !== 'desktop' && section !== 'base'" block-id="read_only_notice" />
    <div v-if="section === 'base'" class="dnd-tablet-base">
      <DndIdentityCard compact />
      <DndUtilities />
    </div>
    <DndStats v-else-if="section === 'stats'" :format="format" />
    <CharacterBlock v-else-if="section === 'weapons'" block-id="weapon"
      :options="{ variant: 'list', show_add_in_view: true }" />
    <CharacterBlock v-else-if="section === 'spells'" block-id="spells" :options="{ show_add_in_view: true }" />
    <template v-else-if="section === 'inventory'">
      <CharacterBlock v-if="format === 'phone'" block-id="campaign" />
      <CharacterBlock block-id="items" />
    </template>
    <DndAbilities v-else-if="section === 'abilities'" :format="format" />
    <template v-else-if="section === 'personality'">
      <DndPersonalityDesktop v-if="format === 'desktop'" />
      <DndPersonalityCompact v-else class="dnd-personality-compact" />
    </template>
    <template v-else-if="section === 'journal'">
      <CharacterBlock block-id="diary" />
      <BaseTile class="sheet-notes"><CharacterBlock block-id="notes" /></BaseTile>
    </template>
  </div>
</template>
<script setup>
import { BaseTile } from '@sylvieshare/share-ui'
import CharacterBlock from '../CharacterBlock.vue'
import DndStats from './DndStats.vue'
import DndIdentityCard from './DndIdentityCard.vue'
import DndUtilities from './DndUtilities.vue'
import DndAbilities from './DndAbilities.vue'
import DndPersonalityCompact from './DndPersonalityCompact.vue'
import DndPersonalityDesktop from './DndPersonalityDesktop.vue'
defineProps({ section: String, format: String })
</script>
<style scoped>
.dnd-section { gap: 16px; }
.dnd-tablet-base { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, var(--layout-sheet-base-min)), 1fr)); align-items: start; gap: 20px; }
.dnd-tablet-base :deep(> *) { min-width: 0; }
.sheet-notes { padding: 18px; }
@container character-sheet (min-width: 720px) {
  .dnd-personality-compact { columns: 2; display: block; column-gap: 16px; }
  .dnd-personality-compact :deep(> *) { break-inside: avoid; margin-bottom: 16px; }
}
</style>
