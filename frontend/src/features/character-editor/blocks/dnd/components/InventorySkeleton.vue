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

<style scoped src="../styles/DndItems.css"></style>
