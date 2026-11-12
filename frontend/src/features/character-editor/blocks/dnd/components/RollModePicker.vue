<template>
  <div class="roll-mode-picker" role="group" aria-label="Режим броска">
    <RollModeOption
      v-for="mode in ['disadvantage', 'advantage']"
      :key="mode"
      :mode="mode"
      :selected="modelValue === mode"
      :disabled="disabled"
      @select="emit('update:modelValue', $event ? mode : neutralMode)"
    />
  </div>
</template>
<script setup>
import RollModeOption from './RollModeOption.vue'
defineProps({
  modelValue: { type: String, default: 'normal' },
  neutralMode: { type: String, default: 'normal' },
  disabled: Boolean,
})
const emit = defineEmits(['update:modelValue'])
</script>
<style scoped>
.roll-mode-picker { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--spacing-small); --choice-card-min-height: var(--layout-roll-mode-card-min-height); --choice-card-padding: var(--spacing-compact) var(--spacing-small); --choice-card-gap: var(--spacing-xs); }
</style>
