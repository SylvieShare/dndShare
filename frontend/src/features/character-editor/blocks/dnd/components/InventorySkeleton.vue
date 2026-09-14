<template>
  <div class="di-list-col" aria-busy="true" aria-label="Загрузка инвентаря">
    <BaseTile v-for="section in sections" :key="section.id" class="di-section">
      <div class="di-section-head"><span class="di-section-name">{{ section.name }}</span></div>
      <div v-for="(item, index) in section.items" :key="item.uid || index" class="di-row" aria-hidden="true">
        <SkeletonBlock width="32px" height="32px" />
        <SkeletonBlock width="60%" height="13px" />
      </div>
    </BaseTile>
  </div>
</template>

<script setup>
import { BaseTile, SkeletonBlock } from '@sylvieshare/share-ui'
defineProps({ sections: { type: Array, default: () => [] } })
</script>

<style scoped>
.di-list-col {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.di-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
  padding: 16px 18px;
}


.di-section-head {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 24px;
}

.di-section-name {
  background: none;
  border: none;
  padding: 0;
  font-size: 12px;
  font-weight: 650;
  letter-spacing: 0.08em;
  line-height: 1.15;
  text-transform: uppercase;
  color: var(--text-muted);
  cursor: default;
  transition: color 0.15s;
}

.di-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 80px;
  padding: 14px 4px;
  transition: background 0.12s;
}

@media (max-width: 760px) {
  .di-section {
    padding: 14px;
  }
}
</style>
