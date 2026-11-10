<template>
  <div v-if="hasStates" class="strip" aria-label="Состояния персонажа">
    <CharacterBlock block-id="desktop_statuses" :options="{ variant: 'header' }" />
  </div>
</template>
<script setup>
import CharacterBlock from '../CharacterBlock.vue'
import { computed, inject } from 'vue'
import { isInspirationActive } from '../../blocks/dnd/lib/mobileStatus'
const ctx = inject('charCtx', {})
const hasStates = computed(() => ctx.characterStatuses?.entries?.length || ctx.values?.exhaustion?.level > 0 || isInspirationActive(ctx.values?.inspiration))
</script>
<style scoped>
.strip {display:flex; align-items:center; gap:var(--spacing-label); min-width:0; padding:0 var(--spacing-page); margin:auto; max-width:var(--layout-sheet-max); min-height:40px}
.strip :deep(.character-sheet-field){flex:none}
@media (--ui-compact){.strip{gap:var(--spacing-xs)}}
</style>
