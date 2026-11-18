<template>
  <div class="roster-selection-summary" aria-label="Выбрано по видам">
    <span v-if="groups.length" class="selection-summary-caption" aria-hidden="true">Выбрано:</span>
    <span v-if="!groups.length" class="selection-summary-empty">Никто не выбран</span>
    <span v-for="group in groups" :key="group.key" class="selection-summary-item" :title="`${group.name} × ${group.count}`" role="img" :aria-label="`${group.name}: ${group.count}`">
      <CharacterAvatar v-if="group.player" :src="group.url" :name="group.name" size="var(--layout-selection-summary-icon)" />
      <SessionCreatureAvatar v-else :url="group.url" :svg="group.svg" :name="group.name" icon />
      <span class="selection-summary-quantity" aria-hidden="true">{{group.count}}</span>
    </span>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import CharacterAvatar from '@/features/character-editor/components/CharacterAvatar.vue'
import SessionCreatureAvatar from './SessionCreatureAvatar.vue'
import { selectedRosterGroups } from '../lib/selectedRosterGroups'
const props=defineProps({items:{type:Array,required:true},encounter:{type:Object,required:true}})
const groups=computed(()=>selectedRosterGroups(props.items,props.encounter))
</script>
<style scoped>
.roster-selection-summary {display:flex;align-items:center;gap:var(--spacing-small);min-width:0;flex:1;overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:none;padding:var(--spacing-xs);--creature-avatar-size:var(--layout-selection-summary-icon)}
.roster-selection-summary::-webkit-scrollbar {display:none}
.selection-summary-item {position:relative;display:inline-flex;flex:none;padding-inline-end:var(--spacing-small);padding-bottom:var(--spacing-xs)}
.selection-summary-quantity {position:absolute;bottom:0;inset-inline-end:0;display:grid;place-items:center;min-width:var(--spacing-large);height:var(--spacing-large);padding-inline:var(--spacing-xs);border-radius:var(--radius-small);background:var(--surface-active);color:var(--text-1);font-size:var(--type-context-size);font-variant-numeric:tabular-nums}
.selection-summary-empty {font-size:var(--type-caption-size);color:var(--text-muted);white-space:nowrap}
.selection-summary-caption {flex:none;font-size:var(--type-caption-size);color:var(--text-muted)}
</style>
