<template>
  <ActionButton
    class="roster-action"
    :class="{ 'roster-action--active': active }"
    variant="quiet"
    layout="stacked"
  >
    <template #icon>
      <span class="roster-action-icon" :class="{ 'roster-action-icon--danger': danger }" aria-hidden="true">
        <component :is="icon" :size="20" />
        <span v-if="count != null" class="roster-action-count">{{ count }}</span>
      </span>
    </template>
    <slot />
    <kbd v-if="shortcut" class="roster-action-shortcut" aria-hidden="true">{{ shortcut }}</kbd>
  </ActionButton>
</template>

<script setup>
import { ActionButton } from '@sylvieshare/share-ui'

defineProps({
  icon: { type: [Object, Function], required: true },
  count: Number,
  danger: Boolean,
  active: Boolean,
  shortcut: String,
})
</script>

<style scoped>
.roster-action.share-action-button {
  --action-button-height: calc(var(--layout-touch-min) + var(--spacing-small));
  position: relative;
  min-width: 0;
  padding-inline: var(--spacing-xs);
}
.roster-action.roster-action--active {
  background: color-mix(in srgb, var(--accent) 18%, var(--surface-raised));
  color: var(--accent-soft);
}
.roster-action-icon { position: relative; display: inline-flex; }
.roster-action-icon--danger { color: var(--danger); }
.roster-action-count {
  position: absolute;
  left: calc(100% - var(--spacing-xs));
  top: calc(var(--spacing-xs) * -1);
  min-width: var(--spacing-large);
  height: var(--spacing-large);
  box-sizing: border-box;
  padding-inline: var(--spacing-xs);
  border-radius: var(--radius-small);
  background: var(--surface-active);
  color: var(--text-1);
  font: 600 var(--type-context-size)/var(--spacing-large) var(--font-ui);
}
.roster-action-shortcut {
  position: absolute;
  inset-inline-end: 0;
  inset-block-end: 0;
  padding-inline: var(--spacing-xs);
  border-radius: var(--radius-small);
  background: var(--popover-bg);
  color: var(--accent-soft);
  font: 500 var(--type-context-size)/var(--type-context-line-height) var(--font-ui);
}
</style>
