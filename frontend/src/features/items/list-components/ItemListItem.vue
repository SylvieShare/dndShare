<template>
  <ObjectListItem :item="item" :type="type" :name-en="item.nameEn || ''" :custom="item.userId != null" :subtitle="subtitle">
    <template v-if="costLabel" #trailing><span class="ili-cost">{{ costLabel }}</span></template>
  </ObjectListItem>
</template>

<script setup>
import { computed } from 'vue'
import ObjectListItem from '@/features/items/list-components/ObjectListItem'
import { measuredItemEconomy } from '@/features/items/lib/itemInstance'
import { useCostFormatter } from '@/features/items/lib/useCostFormatter'

const props = defineProps({
  item: { type: Object, required: true },
  type: { type: Object, default: null },
})

const data = computed(() => props.item.data || {})
const measuredEconomy = computed(() => measuredItemEconomy(props.type, props.item))
const { format: formatCost } = useCostFormatter()
const costLabel = computed(() => {
  const label = formatCost(data.value.cost || measuredEconomy.value?.cost)
  if (!label || !measuredEconomy.value) return label
  return `${label} / ${measuredEconomy.value.quantity} ${measuredEconomy.value.unit}`
})

const subtitle = computed(() => {
  const measuredWeight = measuredEconomy.value?.weight
  const weight = data.value.weight ?? measuredWeight
  const weightLabel = weight != null
    ? `${String(weight).replace('.', ',')} фн.${measuredEconomy.value ? ` / ${measuredEconomy.value.quantity} ${measuredEconomy.value.unit}` : ''}`
    : null
  const parts = [
    data.value.type || data.value.subtype,
    weightLabel,
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
