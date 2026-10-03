<template>
  <ActionButton
    variant="quiet"
    class="utility-cell action-menu-source"
    :class="{ 'utility-cell--stacked': stacked, 'utility-cell--inline': inline, 'action-menu-source--open': active }"
    :aria-label="label"
    :disabled="disabled"
    @click="emit('click', $event)"
  >
    <template v-if="$slots.icon && !inline" #icon><slot name="icon" /></template>
    <slot name="decoration" />
    <span v-if="inline" class="utility-cell-row">
      <span v-if="$slots.icon" class="utility-cell-icon"><slot name="icon" /></span>
      <slot />
    </span>
    <slot v-else />
  </ActionButton>
</template>

<script setup>
import { ActionButton } from '@sylvieshare/share-ui'

defineProps({ label: String, disabled: Boolean, active: Boolean, stacked: Boolean, inline: Boolean })
const emit = defineEmits(['click'])
</script>

<style scoped>
.utility-cell.share-action-button {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  padding: 6px 10px 12px;
  border: 0;
  border-radius: 0;
  box-sizing: border-box;
  user-select: none;
}
.utility-cell--stacked { text-align: left; }
.utility-cell--stacked :deep(> span) { display: flex; flex-direction: column; gap: 4px; width: 100%; min-width: 0; }
.utility-cell--inline.share-action-button { padding-top: 12px; }
.utility-cell--inline :deep(> span) { display: block; width: 100%; min-width: 0; text-align: left; }
.utility-cell-row { display: flex; align-items: center; gap: 4px; }
.utility-cell-icon { display: flex; align-items: center; justify-content: center; flex: 0 0 20px; width: 20px; height: 20px; color: var(--text-muted); }
.utility-cell-icon :deep(img), .utility-cell-icon :deep(svg) { width: 20px; height: 20px; }
.utility-cell.action-menu-source--open { box-shadow: none; transform: none; }
</style>
