<template>
  <div class="gear-summary">
    <div class="gear-economy">
      <div v-if="costLabel" class="gear-economy-card gear-economy-cost">
        <span><Coins :size="14" aria-hidden="true" /> Стоимость</span>
        <strong>{{ costLabel }}</strong>
      </div>
      <div v-if="data.weight != null" class="gear-economy-card gear-economy-weight">
        <span><Weight :size="14" aria-hidden="true" /> Вес</span>
        <strong>{{ data.weight }} <small>фунт.</small></strong>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Coins, Weight } from '@lucide/vue'
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
  width: min(100%, 360px);
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
}

.gear-economy-card {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 11px 13px;
  border: 1px solid color-mix(in srgb, var(--text-on-accent) 18%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--surface) 78%, transparent);
  box-shadow: 0 8px 24px color-mix(in srgb, var(--scrim) 50%, transparent);
  backdrop-filter: blur(7px);
}

.gear-economy-card > span {
  display: flex;
  align-items: center;
  gap: 5px;
  color: color-mix(in srgb, var(--text-on-accent) 58%, transparent);
  font-size: 9px;
  font-weight: 750;
  letter-spacing: .09em;
  text-transform: uppercase;
}

.gear-economy-card strong {
  overflow: hidden;
  color: var(--text-on-accent);
  font-size: 20px;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gear-economy-card small { color: color-mix(in srgb, var(--text-on-accent) 66%, transparent); font-size: 10px; }
.gear-economy-card:only-child { grid-column: 1 / -1; }
.gear-economy-cost { border-color: color-mix(in srgb, var(--warning) 44%, transparent); }
.gear-economy-cost > span { color: color-mix(in srgb, var(--warning) 78%, var(--text-on-accent)); }
.gear-economy-weight { border-color: color-mix(in srgb, var(--accent) 40%, transparent); }
.gear-economy-weight > span { color: color-mix(in srgb, var(--accent-soft) 72%, var(--text-on-accent)); }

@media (max-width: 420px) {
  .gear-economy { gap: 7px; }
  .gear-economy-card { padding: 9px 10px; }
  .gear-economy-card strong { font-size: 17px; }
}
</style>
