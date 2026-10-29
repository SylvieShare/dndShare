<template>
  <BaseTile :outlined="false" class="sheet-item-skeleton" aria-busy="true" aria-label="Загружаем запись">
    <SkeletonBlock round width="56px" height="56px" />
    <div class="sheet-item-skeleton-lines">
      <SkeletonBlock width="70%" height="18px" />
      <SkeletonBlock height="12px" />
      <SkeletonBlock width="50%" height="12px" />
    </div>
  </BaseTile>
</template>
<script setup>
import { BaseTile, SkeletonBlock } from '@sylvieshare/share-ui'
</script>
<style scoped>
.sheet-item-skeleton { display: flex; gap: 12px; padding: 20px; }
.sheet-item-skeleton-lines { display: flex; flex: 1; min-width: 0; flex-direction: column; gap: 12px; }
</style>
