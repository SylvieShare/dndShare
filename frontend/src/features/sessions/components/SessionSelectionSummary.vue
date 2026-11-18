<template>
  <div class="roster-selection-summary" role="group" aria-label="Выбрано по видам">
    <span v-if="groups.length" class="selection-summary-caption" aria-hidden="true">Выбрано:</span>
    <span v-if="!groups.length" class="selection-summary-empty">Никто не выбран</span>
    <div v-if="groups.length" class="selection-summary-icons">
      <div class="selection-summary-stack" :style="stackStyle">
        <span
          v-for="group in groups"
          :key="group.key"
          class="selection-summary-item"
          :title="group.count > 1 ? `${group.name} × ${group.count}` : group.name"
          role="img"
          :aria-label="group.count > 1 ? `${group.name}: ${group.count}` : group.name"
        >
          <span class="selection-summary-portrait" aria-hidden="true">
            <CharacterAvatar v-if="group.player" :src="group.url" :name="group.name" size="var(--layout-selection-summary-icon)" />
            <SessionCreatureAvatar v-else :url="group.url" :svg="group.svg" :name="group.name" icon />
          </span>
          <span v-if="group.count > 1" class="selection-summary-quantity" aria-hidden="true">{{ group.count }}</span>
        </span>
      </div>
    </div>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import CharacterAvatar from '@/features/character-editor/components/CharacterAvatar.vue'
import SessionCreatureAvatar from './SessionCreatureAvatar.vue'
import { selectedRosterGroups } from '../lib/selectedRosterGroups'
const props = defineProps({
  items: { type: Array, required: true },
  encounter: { type: Object, required: true },
})
const groups = computed(() => selectedRosterGroups(props.items, props.encounter))
const stackStyle = computed(() => ({
  '--selection-summary-intervals': Math.max(1, groups.value.length - 1),
  '--selection-summary-count-digits': Math.max(1, ...groups.value.map(group => String(group.count).length)),
}))
</script>
<style scoped>
.roster-selection-summary {
  display: flex;
  align-items: start;
  gap: var(--spacing-small);
  min-width: 0;
  padding: var(--spacing-xs);
}
.selection-summary-icons {
  container-type: inline-size;
  flex: 1;
  min-width: 0;
}
.selection-summary-stack {
  --creature-avatar-size: var(--layout-selection-summary-icon);
  --selection-summary-badge-min: max(var(--spacing-large), calc(var(--selection-summary-count-digits) * 1ch + var(--spacing-xs)));
  --selection-summary-step: clamp(
    var(--selection-summary-badge-min),
    calc((100cqi - var(--layout-selection-summary-icon) - .5px) / var(--selection-summary-intervals)),
    calc(var(--layout-selection-summary-icon) + var(--spacing-small))
  );
  display: flex;
  flex-wrap: wrap;
  row-gap: var(--spacing-xs);
  isolation: isolate;
  /* Leave room for the part of the final portrait that extends past its slot. */
  padding-inline-end: max(0px, calc(var(--layout-selection-summary-icon) - var(--selection-summary-step)));
  font-size: var(--type-context-size);
  font-variant-numeric: tabular-nums;
}
.selection-summary-item {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: start;
  inline-size: var(--selection-summary-step);
}
.selection-summary-item:last-child {
  inline-size: min(var(--selection-summary-step), var(--layout-selection-summary-icon));
}
.selection-summary-portrait {
  display: flex;
}
.selection-summary-quantity {
  position: relative;
  z-index: 1;
  align-self: end;
  display: grid;
  place-items: center;
  box-sizing: border-box;
  min-inline-size: var(--spacing-large);
  block-size: var(--spacing-large);
  margin-block-start: calc(var(--spacing-xs) * -1);
  padding-inline: calc(var(--spacing-xs) / 2);
  border-radius: var(--radius-small);
  background: var(--surface-active);
  color: var(--text-1);
}
.selection-summary-empty {font-size:var(--type-caption-size);color:var(--text-muted)}
.selection-summary-caption {flex:none;font-size:var(--type-caption-size);color:var(--text-muted)}
.selection-summary-caption {line-height: var(--layout-selection-summary-icon)}
</style>
