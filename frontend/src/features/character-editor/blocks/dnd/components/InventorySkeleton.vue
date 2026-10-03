<template>
  <div class="inventory-loading-sections" aria-busy="true" aria-label="Загрузка инвентаря">
    <section v-for="section in sections" :key="section.id" class="di-space">
      <div class="di-section-head"><span class="di-section-name">{{ section.name }}</span></div>
      <div class="inventory-loading-grid" aria-hidden="true">
        <SkeletonBlock v-for="(item, index) in section.items" :key="item.uid || index" class="inventory-loading-cell" />
      </div>
    </section>
  </div>
</template>
<script setup>
import { SkeletonBlock } from '@sylvieshare/share-ui'
defineProps({ sections: { type: Array, default: () => [] } })
</script>
<style scoped src="../styles/DndItems.css"></style>
<style scoped>
.inventory-loading-sections { display: flex; flex-direction: column; gap: 20px; }
.inventory-loading-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); gap: 8px; }
.inventory-loading-cell { aspect-ratio: 1; }
</style>
