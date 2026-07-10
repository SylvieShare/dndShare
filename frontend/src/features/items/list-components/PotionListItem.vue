<template>
  <ObjectListItem :item="item" :gap="12" :custom="item.userId != null">
    <template #leading><PotionVial class="pli-vial" :color="data.color" :rarity="rarity" size="sm" /></template>
    <template #subtitle>
      <span class="pli-rarity" :style="{ color: preset.color }">{{ preset.label }}</span>
      <template v-if="data.weight != null"><span class="pli-dot">·</span>{{ data.weight }} фн.</template>
    </template>
    <template v-if="costLabel" #trailing><span class="pli-cost">{{ costLabel }}</span></template>
  </ObjectListItem>
</template>

<script setup>
import { computed } from 'vue'

import ObjectListItem from '@/features/items/list-components/ObjectListItem'
import PotionVial from '@/features/items/components/PotionVial'
import { rarityOf } from '@/features/items/lib/potionRarity'
import { useCostFormatter } from '@/features/items/lib/useCostFormatter'

const props = defineProps({
  item: { type: Object, required: true },
  type: { type: Object, default: null },
})

const data = computed(() => props.item.data || {})
const rarity = computed(() => Number(data.value.rarity) || 0)
const preset = computed(() => rarityOf(rarity.value))
const { format: formatCost } = useCostFormatter()
const costLabel = computed(() => formatCost(data.value.cost))
</script>

<style scoped>
.pli-vial { flex-shrink: 0; }
.pli-rarity { font-weight: 700; }
.pli-dot { margin: 0 5px; color: var(--text-muted); }

.pli-cost {
  font-size: 12px;
  color: var(--text-2);
  white-space: nowrap;
}
</style>
