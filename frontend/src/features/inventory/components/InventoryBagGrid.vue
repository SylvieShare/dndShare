<template>
  <div class="inventory-bag-grid" :data-sortable-container="group" :aria-label="label">
    <BaseTile v-for="(entry, index) in cells" :key="index" class="inventory-bag-cell"
      :class="{ 'inventory-bag-cell--target': sortable?.dragging && sortable?.targetGroup === group && sortable?.targetIndex === index }"
      :data-sortable-slot="index" :aria-label="!entry ? `Свободная ячейка ${index + 1}` : undefined">
      <slot v-if="entry" :entry="entry" :index="index" />
      <Backpack v-else class="inventory-bag-empty" :size="28" aria-hidden="true" />
    </BaseTile>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import { BaseTile } from '@sylvieshare/share-ui'
import { Backpack } from '@lucide/vue'
import { bagCells } from '../lib/bagSlots'
const props = defineProps({
  entries: { type: Array, default: () => [] },
  positions: { type: Object, default: () => ({}) },
  getKey: { type: Function, default: entry => entry.uid },
  group: { type: String, required: true },
  label: { type: String, default: 'Рюкзак' },
  sortable: { type: Object, default: null },
})
const cells = computed(() => bagCells(props.entries, props.positions, props.getKey))
</script>
<style scoped>
.inventory-bag-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; width: 100%; max-width: 360px; align-self: center; }
.inventory-bag-cell { aspect-ratio: 1; min-width: 0; display: flex; align-items: center; justify-content: center; }
.inventory-bag-cell--target { outline: 2px solid var(--accent); outline-offset: 2px; }
.inventory-bag-empty { color: var(--text-muted); opacity: .25; pointer-events: none; }
.inventory-bag-cell :deep(.ram-custom-trigger) { width: 100%; height: 100%; }
</style>
