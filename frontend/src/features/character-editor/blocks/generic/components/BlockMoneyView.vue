<template>
  <MorphTile :embedded="panel" padding="0" edit-label="Редактировать" :title="title" :show-edit="editable" @edit="$emit('edit', $event)" class="money-view">
    <LoadingState v-if="loading" class="money-empty" label="Загрузка..." compact />
    <div v-else class="money-line">
      <template v-if="rows.length">
        <span v-for="coin in rows" :key="`${coin.id}:${changes.get(String(coin.id))?.version || 0}`" class="money-amount"
          :class="{ 'money-amount--gain': changes.get(String(coin.id))?.delta > 0, 'money-amount--spend': changes.get(String(coin.id))?.delta < 0 }"
          :data-money-id="coin.id" :title="coin.title">
          <ItemIcon v-if="coin.iconImageUrl || coin.svg" class="ma-img" :item="coin" :size="24" :fallback-to-type="false" />
          <span v-else class="ma-dot" :style="{ background: coin.color }"></span>
          <span class="ma-value">{{ formatAmount(coin.amount) }}</span>
          <span class="ma-label">{{ coin.title }}</span>
          <span v-if="changes.has(String(coin.id))" class="ma-change" aria-hidden="true">{{ formatDelta(changes.get(String(coin.id)).delta) }}</span>
        </span>
      </template>
      <span v-else class="money-empty">Денег нет</span>
    </div>
  </MorphTile>
</template>

<script setup>
import { MorphTile } from '@sylvieshare/share-ui'
import { LoadingState } from '@sylvieshare/share-ui'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import { useMoneyFeedback } from '@/features/character-editor/composables/useMoneyFeedback'
const props = defineProps({
  panel: Boolean,
  editable: { type: Boolean, default: false },
  title: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  // Non-zero coins with their shared image/SVG projection, already ordered.
  coins: { type: Array, default: () => [] },
})
defineEmits(['edit'])
const { rows, changes } = useMoneyFeedback(() => props.coins, () => props.loading)
const formatter = new Intl.NumberFormat('ru-RU')
const formatAmount = amount => formatter.format(amount)
const formatDelta = delta => `${delta > 0 ? '+' : '−'}${formatter.format(Math.abs(delta))}`
</script>

<style scoped>
.money-view { min-width: 0; padding: 12px 14px; }

.money-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.money-amount {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 9px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--surface-raised) 60%, transparent);
  transform-origin: center;
}

.ma-value {
  font-size: 20px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text-1);
  line-height: 1;
}

.ma-dot {
  align-self: center;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: inset 0 1px 1px color-mix(in srgb, var(--text-on-accent) 26%, transparent), 0 0 0 1px color-mix(in srgb, var(--scrim) 26%, transparent);
}

.ma-img {
  align-self: center;
}

.ma-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-2);
  line-height: 1.1;
  white-space: nowrap;
}

.money-amount--gain { --money-change-color: var(--success); }
.money-amount--spend { --money-change-color: var(--danger); }
.money-amount--gain, .money-amount--spend { animation: money-balance-pulse 1.1s ease-out both; }
.money-amount--gain .ma-value, .money-amount--spend .ma-value { animation: money-value-flash 1.1s ease-out both; }
.ma-change {
  position: absolute;
  top: -9px;
  right: 5px;
  padding: 1px 4px;
  border-radius: 5px;
  background: var(--surface-raised);
  color: var(--money-change-color);
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  pointer-events: none;
}

@keyframes money-balance-pulse {
  0%, 100% { border-color: var(--border); background: color-mix(in srgb, var(--surface-raised) 60%, transparent); box-shadow: none; transform: scale(1); }
  22% { border-color: color-mix(in srgb, var(--money-change-color) 70%, var(--border)); background: color-mix(in srgb, var(--money-change-color) 18%, var(--surface-raised)); box-shadow: 0 0 14px color-mix(in srgb, var(--money-change-color) 22%, transparent); transform: scale(1.035); }
}
@keyframes money-value-flash {
  0%, 100% { color: var(--text-1); }
  22% { color: var(--money-change-color); }
}
@media (prefers-reduced-motion: reduce) {
  .money-amount--gain, .money-amount--spend { animation: none; border-color: var(--money-change-color); background: color-mix(in srgb, var(--money-change-color) 12%, var(--surface-raised)); }
  .money-amount--gain .ma-value, .money-amount--spend .ma-value { animation: none; color: var(--money-change-color); }
}

.money-empty {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-muted);
}

@media (max-width: 420px) {
  .money-line {
    gap: 5px 14px;
  }
}
</style>
