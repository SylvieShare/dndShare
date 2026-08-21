<template>
  <div class="tool-summary">
    <CoverSummaryLayout>
      <template #left>
        <CoverStatCard
          v-if="costLabel"
          :icon="Coins"
          label="Стоимость"
          :value="costLabel"
          tone="warning"
          size="medium"
        />
      </template>

      <template #right>
        <CoverStatCard
          v-if="data.weight != null"
          :icon="Weight"
          label="Вес"
          :value="data.weight"
          note="фунт."
          tone="accent"
          size="medium"
        />
      </template>

      <template #bottom>
        <CoverSummaryRail columns="1fr">
          <CoverSummaryRailItem :icon="BadgeCheck" label="Требуется владение">
            {{ proficiencyLabel }}
          </CoverSummaryRailItem>
        </CoverSummaryRail>
      </template>
    </CoverSummaryLayout>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { BadgeCheck, Coins, Weight } from '@lucide/vue'
import CoverStatCard from '@/features/items/components/cover/CoverStatCard.vue'
import CoverSummaryLayout from '@/features/items/components/cover/CoverSummaryLayout.vue'
import CoverSummaryRail from '@/features/items/components/cover/CoverSummaryRail.vue'
import CoverSummaryRailItem from '@/features/items/components/cover/CoverSummaryRailItem.vue'
import { useCostFormatter } from '@/features/items/lib/useCostFormatter'
import { useSuggestStore } from '@/stores/suggest'

const props = defineProps({
  item: { type: Object, required: true },
})

const suggestStore = useSuggestStore()
suggestStore.ensure(5)

const data = computed(() => props.item.data || {})
const { format: formatCost } = useCostFormatter()
const costLabel = computed(() => formatCost(data.value.cost))
const proficiencyLabel = computed(() => {
  const ids = Array.isArray(data.value.required_tool_proficiencies)
    ? data.value.required_tool_proficiencies
    : []
  const labels = ids
    .map(id => suggestStore.items(5).find(row => row.id === id)?.value)
    .filter(Boolean)
  return labels.length ? labels.join(' или ') : 'Не требуется'
})
</script>

<style scoped>
.tool-summary {
  flex: 1;
  width: 100%;
  display: flex;
}
</style>
