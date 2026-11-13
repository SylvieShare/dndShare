<template>
  <div class="strip" aria-label="Состояния персонажа">
    <CharacterBlock block-id="desktop_statuses" :options="{ variant: 'header', showAddAction: false }" />
  </div>
</template>
<script setup>
import CharacterBlock from '../CharacterBlock.vue'
</script>
<style scoped>
.strip {display:flex; align-items:center; gap:var(--spacing-label); min-width:0; margin:auto; min-height:var(--layout-sheet-header-status-icon)}
.strip :deep(.character-sheet-field){flex:1;min-width:0}
@media (--ui-compact){.strip{gap:var(--spacing-xs)}}
</style>
