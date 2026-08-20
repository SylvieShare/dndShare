<template>
  <div class="cover-summary-rail" :style="railStyle"><slot /></div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  columns: { type: [Number, String], default: 3 },
})

const railStyle = computed(() => ({
  '--cover-summary-rail-columns': typeof props.columns === 'number'
    ? `repeat(${props.columns}, minmax(0, 1fr))`
    : props.columns,
}))
</script>

<style scoped>
.cover-summary-rail {
  display: grid;
  grid-template-columns: var(--cover-summary-rail-columns);
  gap: 0;
  padding: 5px 4px;
  border: 1px solid color-mix(in srgb, var(--text-on-accent) 18%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--surface) 74%, transparent);
  box-shadow: 0 8px 24px color-mix(in srgb, var(--scrim) 34%, transparent);
  backdrop-filter: blur(6px);
}

.cover-summary-rail :deep(.cover-summary-rail-item + .cover-summary-rail-item) {
  border-left: 1px solid color-mix(in srgb, var(--text-on-accent) 13%, transparent);
}

@media (max-width: 520px) {
  .cover-summary-rail { grid-template-columns: 1fr; }
  .cover-summary-rail :deep(.cover-summary-rail-item + .cover-summary-rail-item) {
    border-top: 1px solid color-mix(in srgb, var(--text-on-accent) 13%, transparent);
    border-left: 0;
  }
}
</style>
