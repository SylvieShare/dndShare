<template>
  <template v-if="hasDetails">
    <span v-if="data.weight != null" class="itd-weight">{{ data.weight }} фунт.</span>
    <span v-if="costLabel" class="itd-cost">{{ costLabel }}</span>
  </template>
</template>

<script setup>
import { computed } from 'vue'
import { useCostFormatter } from '@/features/items/lib/useCostFormatter'

const props = defineProps({
  item: { type: Object, required: true },
})

const data = computed(() => props.item.data || {})
const { format: formatCost } = useCostFormatter()
const costLabel = computed(() => formatCost(data.value.cost))
const hasDetails = computed(() => data.value.weight != null || !!costLabel.value)
</script>

<style scoped>
.itd-weight,
.itd-cost {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--text-on-accent) 6%, transparent);
  color: var(--text-muted);
}
.itd-cost { color: var(--warning); background: color-mix(in srgb, var(--warning) 12%, transparent); }
</style>
