<template>
  <div class="roster-selection-summary" role="group" aria-label="Выбрано по видам">
    <span v-if="groups.length" class="selection-summary-caption" aria-hidden="true">
      <span class="selection-summary-caption-full">Выбрано:</span>
      <span class="selection-summary-caption-compact">Выбр.</span>
    </span>
    <span v-if="!groups.length" class="selection-summary-empty">Никто не выбран</span>
    <SessionSelectionPortraits v-if="groups.length" :groups="groups" />
  </div>
</template>
<script setup>
import { computed } from 'vue'
import SessionSelectionPortraits from './SessionSelectionPortraits.vue'
import { selectedRosterGroups } from '../lib/selectedRosterGroups'
const props = defineProps({
  items: { type: Array, required: true },
  encounter: { type: Object, required: true },
})
const groups = computed(() => selectedRosterGroups(props.items, props.encounter))
</script>
<style scoped>
.roster-selection-summary {
  display: flex;
  align-items: start;
  flex-wrap: wrap;
  column-gap: var(--spacing-small);
  min-width: 0;
  container-type: inline-size;
  box-sizing: border-box;
  min-block-size: calc(var(--layout-selection-summary-icon) + var(--spacing-large) + var(--spacing-xs));
  padding: var(--spacing-xs);
}
.selection-summary-empty,
.selection-summary-caption {
  flex: none;
  max-inline-size: 100%;
  font-size: var(--type-caption-size);
  line-height: var(--layout-selection-summary-icon);
  color: var(--text-muted);
}
.selection-summary-caption-compact { display: none; }
@container (max-width: 58px) {
  .selection-summary-caption-full { display: none; }
  .selection-summary-caption-compact { display: inline; }
  .selection-summary-caption,
  .selection-summary-empty {
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: var(--type-context-size);
    line-height: var(--type-context-line-height);
  }
}
</style>
