<template>
  <ActionButton
    variant="quiet"
    class="utility-cell action-menu-source"
    :class="{ 'utility-cell--stacked': stacked, 'action-menu-source--open': active }"
    :aria-label="label"
    :disabled="disabled"
    @click="emit('click', $event)"
  >
    <template v-if="$slots.icon" #icon><slot name="icon" /></template>
    <slot name="decoration" />
    <slot />
  </ActionButton>
</template>

<script setup>
import { ActionButton } from '@sylvieshare/share-ui'

defineProps({ label: String, disabled: Boolean, active: Boolean, stacked: Boolean })
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
.utility-cell.action-menu-source--open { box-shadow: none; transform: none; }
</style>
