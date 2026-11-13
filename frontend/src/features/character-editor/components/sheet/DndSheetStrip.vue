<template>
  <div v-if="hasStates || showAdd" class="strip" aria-label="Состояния персонажа">
    <CharacterBlock block-id="desktop_statuses" :options="{ variant: 'header', showAddAction: showAdd }" />
  </div>
</template>
<script setup>
import CharacterBlock from '../CharacterBlock.vue'
import { computed, inject } from 'vue'
import { isInspirationActive } from '../../blocks/dnd/lib/mobileStatus'
const ctx = inject('charCtx', {})
defineProps({showAdd:Boolean})
const hasStates = computed(() => ctx.characterStatuses?.entries?.length || ctx.values?.exhaustion?.level > 0 || isInspirationActive(ctx.values?.inspiration))
</script>
<style scoped>
.strip {display:flex; align-items:center; gap:var(--spacing-label); min-width:0; margin:auto; min-height:var(--layout-touch-min)}
.strip :deep(.character-sheet-field){flex:1;min-width:0}
@media (--ui-compact){.strip{gap:var(--spacing-xs)}}
</style>
