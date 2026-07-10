<template>
  <ObjectListItem :item="item" :name-en="item.nameEn || ''" :custom="item.userId != null" :subtitle="subtitle">
    <template #leading><ObjectTypeIcon :type="type" /></template>
    <template v-if="costLabel" #trailing><span class="ili-cost">{{ costLabel }}</span></template>
  </ObjectListItem>
</template>

<script setup>
import { computed } from 'vue'
import ObjectListItem from '@/features/items/list-components/ObjectListItem'
import ObjectTypeIcon from '@/features/items/list-components/ObjectTypeIcon'
import { useCostFormatter } from '@/features/items/lib/useCostFormatter'

const props = defineProps({
  item: { type: Object, required: true },
  type: { type: Object, default: null },
})

const data = computed(() => props.item.data || {})
const { format: formatCost } = useCostFormatter()
const costLabel = computed(() => formatCost(data.value.cost))

const subtitle = computed(() => {
  const parts = [
    data.value.type || data.value.subtype,
    data.value.weight != null ? `${data.value.weight} фн.` : null,
    data.value.is_container ? 'Контейнер' : null,
    data.value.consumable ? 'Расходуемый' : null,
  ].filter(Boolean)
  return parts.join(' · ')
})
</script>

<style scoped>
.ili-cost {
  font-size: 12px;
  color: var(--text-2);
  white-space: nowrap;
}
</style>
