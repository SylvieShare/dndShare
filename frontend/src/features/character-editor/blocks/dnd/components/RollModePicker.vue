<template>
  <div class="roll-mode-picker" role="group" aria-label="Режим броска">
    <ChoiceCard
      v-for="option in options"
      :key="option.mode"
      :label="option.label"
      :description="option.description"
      :color="option.color"
      :model-value="modelValue === option.mode"
      :disabled="disabled"
      @update:model-value="emit('update:modelValue', $event ? option.mode : neutralMode)"
    >
      <template #icon><component :is="option.icon" aria-hidden="true" /></template>
    </ChoiceCard>
  </div>
</template>
<script setup>
import { ChoiceCard } from '@sylvieshare/share-ui'
import { ArrowDown, ArrowUp } from '@lucide/vue'
defineProps({
  modelValue: { type: String, default: 'normal' },
  neutralMode: { type: String, default: 'normal' },
  disabled: Boolean,
})
const emit = defineEmits(['update:modelValue'])
const options = [
  { mode: 'disadvantage', label: 'Помеха', description: 'Меньший из 2к20', color: 'var(--danger)', icon: ArrowDown },
  { mode: 'advantage', label: 'Преимущество', description: 'Больший из 2к20', color: 'var(--success)', icon: ArrowUp },
]
</script>
<style scoped>
.roll-mode-picker { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--spacing-small); --choice-card-min-height: var(--layout-roll-mode-card-min-height); }
</style>
