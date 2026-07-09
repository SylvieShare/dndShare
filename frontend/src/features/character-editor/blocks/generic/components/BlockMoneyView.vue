<template>
  <!-- Shared money face, rendered in the tile and in the morph #view so they never drift.
       Padding is owned by the wrapper (BaseTile / morph face); this is just the content. -->
  <div class="money-view">
    <div v-if="title" class="sheet-tile-title money-title">{{ title }}</div>
    <div v-if="loading" class="money-empty">Загрузка...</div>
    <div v-else class="money-line">
      <template v-if="coins.length">
        <span v-for="coin in coins" :key="coin.id" class="money-amount" :title="coin.title">
          <span class="ma-value">{{ coin.amount }}</span>
          <span v-if="coin.iconUrl" class="ma-img" v-html="coin.iconUrl" aria-hidden="true" />
          <span v-else class="ma-dot" :style="{ background: coin.color }"></span>
          <span class="ma-label">{{ coin.title }}</span>
        </span>
      </template>
      <span v-else class="money-empty">Денег нет</span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  // [{ id, title, iconUrl, color, amount }] — only the non-zero coins, already ordered
  coins: { type: Array, default: () => [] },
})
</script>

<style scoped>
.money-title {
  margin-bottom: 8px;
}

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
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.26), 0 0 0 1px rgba(0, 0, 0, 0.16);
}

.ma-img {
  align-self: center;
  width: 14px;
  height: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.ma-img :deep(svg) {
  width: 14px;
  height: 14px;
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
