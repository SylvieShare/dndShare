<template>
  <div class="pli">
    <PotionVial class="pli-vial" :color="data.color" :rarity="rarity" size="sm" />

    <div class="pli-main">
      <div class="pli-name-row">
        <span class="pli-name">{{ item.name }}</span>
        <span v-if="item.userId != null" class="pli-custom" title="Ваш объект">✦</span>
      </div>
      <div class="pli-sub">
        <span class="pli-rarity" :style="{ color: preset.color }">{{ preset.label }}</span>
        <template v-if="data.weight != null"><span class="pli-dot">·</span>{{ data.weight }} фн.</template>
      </div>
    </div>

    <div class="pli-right">
      <span v-if="costLabel" class="pli-cost">{{ costLabel }}</span>
      <svg class="pli-chevron" viewBox="0 0 16 16" fill="none" width="14" height="14">
        <path d="M6 12L10 8L6 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

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
.pli {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-width: 0;
}

.pli-vial { flex-shrink: 0; }

.pli-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.pli-name-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}

.pli-name {
  font-family: var(--font-display);
  font-size: 17px;
  font-weight: 600;
  color: var(--text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.2;
}

.pli-custom {
  color: var(--accent);
  font-size: 8px;
  flex-shrink: 0;
}

.pli-sub {
  font-size: 11px;
  color: var(--text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pli-rarity { font-weight: 700; }
.pli-dot { margin: 0 5px; color: var(--text-muted); }

.pli-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.pli-cost {
  font-size: 12px;
  color: var(--text-2);
  white-space: nowrap;
}

.pli-chevron {
  color: var(--text-muted);
  flex-shrink: 0;
}
</style>
