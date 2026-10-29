<template>
  <div class="chars-grid" aria-busy="true" aria-label="Загружаем персонажей">
    <BaseTile v-for="row in 3" :key="row" :outlined="false" class="character-list-skeleton">
      <SkeletonBlock width="84px" height="100px" />
      <div class="character-list-skeleton-lines">
        <SkeletonBlock width="70%" height="18px" />
        <SkeletonBlock height="12px" />
        <SkeletonBlock width="50%" height="12px" />
      </div>
    </BaseTile>
  </div>
</template>
<script setup>
import { BaseTile, SkeletonBlock } from '@sylvieshare/share-ui'
</script>
<style scoped>
.chars-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 440px), 1fr)); gap: 16px; }
.character-list-skeleton { display: flex; gap: 14px; padding: 12px; }
.character-list-skeleton-lines { display: flex; flex: 1; min-width: 0; flex-direction: column; gap: 12px; }
</style>
