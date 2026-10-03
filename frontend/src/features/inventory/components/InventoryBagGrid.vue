<template>
  <div ref="grid" class="inventory-bag-grid" :class="{ 'inventory-bag-grid--adaptive': adaptive }" :style="{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }" :data-sortable-container="group" :aria-label="label">
    <BaseTile v-for="(entry, index) in cells" :key="index" class="inventory-bag-cell"
      :class="{ 'inventory-bag-cell--simplified': entry && isSimplified(entry), 'inventory-bag-cell--equipped': entry && isEquipped(entry), 'inventory-bag-cell--target': sortable?.dragging && sortable?.targetGroup === group && sortable?.targetIndex === index }"
      :data-sortable-slot="index" :aria-label="!entry ? `Свободная ячейка ${index + 1}` : undefined">
      <slot v-if="entry" :entry="entry" :index="index" />
      <InventoryBagEmptyCell v-else-if="canAdd" :index="index" :disabled="disabled || sortable?.dragging || sortable?.suppressNextClick"
        @add-catalog="$emit('add-catalog', index)" @add-custom="$emit('add-custom', index)" />
      <InventoryEmptyArtwork v-else class="inventory-bag-empty" />
    </BaseTile>
  </div>
</template>
<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { BaseTile } from '@sylvieshare/share-ui'
import InventoryEmptyArtwork from './InventoryEmptyArtwork.vue'
import { bagCells, bagColumnCount, BAG_COLUMNS } from '../lib/bagSlots'
import InventoryBagEmptyCell from './InventoryBagEmptyCell.vue'
const props = defineProps({
  entries: { type: Array, default: () => [] },
  positions: { type: Object, default: () => ({}) },
  getKey: { type: Function, default: entry => entry.uid },
  group: { type: String, required: true },
  label: { type: String, default: 'Рюкзак' },
  isEquipped: { type: Function, default: () => false },
  isSimplified: { type: Function, default: entry => entry.item_id == null },
  adaptive: Boolean,
  canAdd: Boolean,
  disabled: Boolean,
  sortable: { type: Object, default: null },
})
defineEmits(['add-catalog', 'add-custom'])
const grid = ref(null), measuredWidth = ref(0), columns = ref(BAG_COLUMNS)
function updateColumns() {
  if (props.sortable?.dragging) return
  columns.value = props.adaptive ? bagColumnCount(measuredWidth.value) : BAG_COLUMNS
}
const cells = computed(() => bagCells(props.entries, props.positions, props.getKey, columns.value))
let observer, frame
onMounted(() => {
  measuredWidth.value = grid.value?.clientWidth || 0
  updateColumns()
  observer = new ResizeObserver(entries => {
    const width = entries[0]?.contentRect.width || 0
    if (width === measuredWidth.value) return
    measuredWidth.value = width
    if (frame != null) return
    frame = requestAnimationFrame(() => { frame = null; updateColumns() })
  })
  observer.observe(grid.value)
})
onBeforeUnmount(() => {
  observer?.disconnect()
  if (frame != null) cancelAnimationFrame(frame)
})
watch(() => [props.adaptive, props.sortable?.dragging], updateColumns)
</script>
<style scoped>
.inventory-bag-grid { display: grid; gap: 8px; width: 100%; max-width: 360px; align-self: center; }
.inventory-bag-grid--adaptive { max-width: none; align-self: stretch; }
.inventory-bag-cell { aspect-ratio: 1; min-width: 0; display: flex; align-items: center; justify-content: center; box-shadow: none; }
.inventory-bag-cell::after { content: ''; position: absolute; inset: 0; border: 2px solid var(--border); border-radius: inherit; pointer-events: none; z-index: 1; }
.inventory-bag-cell--simplified::after { border-style: dashed; }
.inventory-bag-cell--equipped::after { border-color: var(--accent); }
.inventory-bag-cell--target { outline: 2px solid var(--accent); outline-offset: 2px; }
.inventory-bag-empty { color: var(--text-muted); opacity: .25; pointer-events: none; }
.inventory-bag-cell :deep(.ram-custom-trigger) { width: 100%; height: 100%; border-radius: inherit; }
</style>
