<template>
  <div class="gear-summary">
    <div class="gear-economy">
      <CoverStatCard
        v-if="costLabel"
        :icon="Coins"
        label="Стоимость"
        :value="costLabel"
        tone="warning"
        size="medium"
        class="gear-economy-card gear-economy-cost"
      />
      <CoverStatCard
        v-if="data.weight != null"
        :icon="Weight"
        label="Вес"
        :value="data.weight"
        note="фунт."
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
import { useCostFormatter } from '@/features/items/lib/useCostFormatter'

const props = defineProps({ item: { type: Object, required: true } })
const data = computed(() => props.item.data || {})
const { format: formatCost } = useCostFormatter()
const costLabel = computed(() => formatCost(data.value.cost))
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
