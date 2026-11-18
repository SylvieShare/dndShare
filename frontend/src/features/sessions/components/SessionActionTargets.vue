<template>
  <span class="action-target-preview" aria-hidden="true">
    <span class="action-target-icons">
      <span v-for="group in groups" :key="group.key" class="action-target-portrait"
        :title="group.count > 1 ? `${group.name} × ${group.count}` : group.name">
        <CharacterAvatar v-if="group.player" :src="group.url" :name="group.name" size="var(--spacing-large)" />
        <SessionCreatureAvatar v-else :url="group.url" :svg="group.svg" :name="group.name" icon />
      </span>
    </span>
    <span class="action-target-count">{{ items.length }}</span>
  </span>
</template>

<script setup>
import { computed } from 'vue'
import CharacterAvatar from '@/features/character-editor/components/CharacterAvatar.vue'
import SessionCreatureAvatar from './SessionCreatureAvatar.vue'
import { selectedRosterGroups } from '../lib/selectedRosterGroups'

const props = defineProps({
  items: { type: Array, required: true },
  encounter: { type: Object, required: true },
})
const groups = computed(() => selectedRosterGroups(props.items, props.encounter))
</script>

<style scoped>
.action-target-preview, .action-target-icons {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
}
.action-target-icons {
  --creature-avatar-size: var(--spacing-large);
  justify-content: flex-end;
  flex-wrap: wrap;
  max-inline-size: calc(4 * (var(--spacing-large) + var(--spacing-xs)));
}
.action-target-portrait { display: inline-flex; flex: none; }
.action-target-count { color: var(--text-2); font-variant-numeric: tabular-nums; }
</style>
