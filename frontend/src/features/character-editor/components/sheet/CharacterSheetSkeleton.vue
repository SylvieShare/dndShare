<template>
  <div class="sheet-skeleton" aria-busy="true" aria-label="Загружаем раздел персонажа">
    <CharacterItemSkeleton />
    <BaseTile :outlined="false" class="sheet-skeleton-group">
      <SkeletonBlock width="40%" height="16px" />
      <SkeletonBlock v-for="row in 3" :key="row" height="28px" />
    </BaseTile>
    <CharacterItemSkeleton />
  </div>
</template>
<script setup>
import { BaseTile, SkeletonBlock } from '@sylvieshare/share-ui'
import CharacterItemSkeleton from './CharacterItemSkeleton.vue'
</script>
<style scoped>
.sheet-skeleton { display: flex; flex-direction: column; gap: 16px; width: 100%; }
.sheet-skeleton-group { display: flex; flex-direction: column; gap: 12px; padding: 20px; }
</style>
