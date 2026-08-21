<template>
  <div class="gear-summary">
    <div class="gear-economy">
      <CoverStatCard
        v-if="costLabel"
        :icon="Coins"
        label="Стоимость"
        :value="costLabel"
        :note="measuredNote"
        tone="warning"
        size="medium"
        class="gear-economy-card gear-economy-cost"
      />
      <CoverStatCard
        v-if="weight != null"
        :icon="Weight"
        label="Вес"
        :value="weight"
        :note="weightNote"
        tone="accent"
        size="medium"
        class="gear-economy-card gear-economy-weight"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Coins, Weight } from '@lucide/vue'
import CoverStatCard from '@/features/items/components/cover/CoverStatCard.vue'
import { measuredItemEconomy } from '@/features/items/lib/itemInstance'
import { useCostFormatter } from '@/features/items/lib/useCostFormatter'

const props = defineProps({
  item: { type: Object, required: true },
  type: { type: Object, default: null },
})
const data = computed(() => props.item.data || {})
const measuredEconomy = computed(() => measuredItemEconomy(props.type, props.item))
const { format: formatCost } = useCostFormatter()
const costLabel = computed(() => formatCost(data.value.cost || measuredEconomy.value?.cost))
const weight = computed(() => data.value.weight ?? measuredEconomy.value?.weight)
const measuredNote = computed(() => measuredEconomy.value
  ? `за ${measuredEconomy.value.quantity} ${measuredEconomy.value.unit}`
  : '')
const weightNote = computed(() => measuredEconomy.value
  ? `фунт. за ${measuredEconomy.value.quantity} ${measuredEconomy.value.unit}`
  : 'фунт.')
</script>

<style scoped>
.gear-summary {
  flex: 1;
  min-height: min-content;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.gear-economy {
  width: 100%;
  display: grid;
  grid-template-columns: minmax(140px, 180px) minmax(180px, 1fr) minmax(140px, 180px);
  gap: 9px;
}

.gear-economy-cost { grid-column: 1; }
.gear-economy-weight { grid-column: 3; }
.gear-economy .gear-economy-card:only-child { grid-column: 1 / 4; justify-self: center; width: min(100%, 180px); box-sizing: border-box; }

@media (max-width: 420px) {
  .gear-economy { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
  .gear-economy-cost { grid-column: 1; }
  .gear-economy-weight { grid-column: 2; }
  .gear-economy .gear-economy-card:only-child { grid-column: 1 / 3; }
}
</style>
