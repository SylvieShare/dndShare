<template>
  <MorphTile :embedded="panel" padding="0" edit-label="Редактировать" :title="title" :show-edit="editable" @edit="$emit('edit', $event)" class="money-view">
    <LoadingState v-if="loading" class="money-empty" label="Загрузка..." compact />
    <div v-else class="money-line">
      <template v-if="coins.length">
        <span v-for="coin in coins" :key="coin.id" class="money-amount" :title="coin.title">
          <span class="ma-value">{{ coin.amount }}</span>
          <ItemIcon v-if="coin.iconImageUrl || coin.svg" class="ma-img" :item="coin" :size="20" :fallback-to-type="false" />
          <span v-else class="ma-dot" :style="{ background: coin.color }"></span>
          <span class="ma-label">{{ coin.title }}</span>
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
defineProps({
  panel: Boolean,
  editable: { type: Boolean, default: false },
  title: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  // Non-zero coins with their shared image/SVG projection, already ordered.
  coins: { type: Array, default: () => [] },
})
defineEmits(['edit'])
</script>

<style scoped>
.money-view { min-width: 0; padding: 12px 14px; }

.money-line {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px 18px;
}

.money-amount {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
}

.ma-value {
  font-size: 20px;
  font-weight: 700;
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
  font-size: 13px;
  font-weight: 500;
  color: var(--text-2);
  line-height: 1.1;
  white-space: nowrap;
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
