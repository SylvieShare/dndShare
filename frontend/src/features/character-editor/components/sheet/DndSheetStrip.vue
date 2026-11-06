<template>
  <div :class="['strip', { 'strip--tablet': format === 'tablet' }]" aria-label="Боевые показатели">
    <CharacterBlock v-for="field in fields" :key="field" :block-id="field" :options="{ variant: 'strip' }" />
    <DndStatusChip @click="emit('open', 'statuses')" />
  </div>
</template>
<script setup>
import CharacterBlock from '../CharacterBlock.vue'
import DndStatusChip from './DndStatusChip.vue'
defineProps({ format: String })
const emit = defineEmits(['open'])
const fields = ['armor','initiative','speed']
</script>
<style scoped>
.strip {display:flex; align-items:center; gap:var(--spacing-label); min-width:0; padding:0 var(--spacing-page); margin:auto; max-width:var(--layout-sheet-max); min-height:40px}
.strip :deep(.character-sheet-field){flex:none}
.strip--tablet :deep(.stat-strip-label){display:inline;color:var(--text-muted);font-weight:400}
@media (--ui-compact){.strip{gap:var(--spacing-xs)}}
</style>
