<template>
  <span class="selection-summary-icons">
    <span class="selection-summary-stack" :style="{ '--selection-summary-intervals': Math.max(1, groups.length - 1) }">
      <span
        v-for="(group, index) in groups"
        :key="group.key"
        class="selection-summary-item"
        :style="{ '--selection-summary-index': index }"
        :title="group.count > 1 ? `${group.name} × ${group.count}` : group.name"
        role="img"
        :aria-label="group.count > 1 ? `${group.name}: ${group.count}` : group.name"
      >
        <span class="selection-summary-portrait" aria-hidden="true">
          <CharacterAvatar v-if="group.player" :src="group.url" :name="group.name" size="var(--creature-avatar-size)" />
          <SessionCreatureAvatar v-else :url="group.url" :svg="group.svg" :name="group.name" icon />
        </span>
        <span v-if="group.count > 1" class="selection-summary-quantity" aria-hidden="true">{{ group.count }}</span>
      </span>
    </span>
  </span>
</template>
<script setup>
import CharacterAvatar from '@/features/character-editor/components/CharacterAvatar.vue'
import SessionCreatureAvatar from './SessionCreatureAvatar.vue'
defineProps({ groups: { type: Array, required: true } })
</script>
<style scoped>
.selection-summary-icons {
  container-type: inline-size;
  flex: 1 1 var(--layout-selection-summary-icon);
  min-width: 0;
}
.selection-summary-stack {
  --creature-avatar-size: min(var(--layout-selection-summary-icon), 100cqi);
  --selection-summary-step: clamp(
    0px,
    calc((100cqi - var(--creature-avatar-size)) / var(--selection-summary-intervals)),
    calc(var(--creature-avatar-size) + var(--spacing-small))
  );
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  place-items: start;
  font-size: var(--type-context-size);
  font-variant-numeric: tabular-nums;
}
.selection-summary-item {
  grid-area: 1 / 1;
  display: flex;
  flex-direction: column;
  inline-size: var(--creature-avatar-size);
  margin-inline-start: calc(var(--selection-summary-index) * var(--selection-summary-step));
  isolation: isolate;
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
  min-inline-size: min(100%, var(--spacing-large));
  max-inline-size: 100%;
  block-size: var(--spacing-large);
  margin-block-start: calc(var(--spacing-xs) * -1);
  padding-inline: calc(var(--spacing-xs) / 2);
  overflow: hidden;
  border-radius: var(--radius-small);
  background: var(--surface-active);
  color: var(--text-1);
}
</style>
