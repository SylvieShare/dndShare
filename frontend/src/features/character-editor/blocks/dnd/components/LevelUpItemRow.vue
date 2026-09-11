<template>
  <BaseTile class="lu-item" :tint="highlighted">
    <button type="button" class="lu-item-open" :aria-label="`Открыть «${item.name}»`" @click="emit('details', item)">
      <HandbookListItem :item="item" :type="{ id: typeId }" />
    </button>
    <div v-if="$slots.default" class="lu-item-actions"><slot /></div>
  </BaseTile>
</template>

<script setup>
import { BaseTile } from '@sylvieshare/share-ui'
import HandbookListItem from '@/features/items/list-components/HandbookListItem.vue'
defineProps({ item: { type: Object, required: true }, typeId: { type: Number, required: true }, highlighted: Boolean })
const emit = defineEmits(['details'])
</script>

<style scoped>
.lu-item { display: flex; align-items: center; gap: 8px; min-width: 0; padding: 4px 12px 4px 4px; }
.lu-item-open { flex: 1; min-width: 0; padding: 0; border: 0; background: transparent; color: inherit; text-align: left; cursor: pointer; }
.lu-item-open:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: var(--r-md); }
.lu-item-open:hover :deep(.oli-name) { color: var(--accent-soft); }
.lu-item-actions { display: flex; align-items: center; gap: 4px; flex: none; }
@media (max-width: 560px) {
  .lu-item { flex-wrap: wrap; }
  .lu-item-open { flex-basis: 100%; }
  .lu-item-actions { margin-left: auto; padding-bottom: 4px; }
}
</style>
