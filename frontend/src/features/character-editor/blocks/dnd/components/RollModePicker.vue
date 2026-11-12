<template>
  <div class="roll-mode-picker" role="group" aria-label="Режим броска">
    <ChoiceCard
      v-for="option in options"
      :key="option.mode"
      layout="icon"
      :style="{ '--choice-card-icon-size': `${layoutTokens['roll-mode-menu-die']}px` }"
      :label="option.label"
      :description="option.description"
      :color="option.color"
      :model-value="modelValue === option.mode"
      :disabled="disabled"
      @update:model-value="emit('update:modelValue', $event ? option.mode : neutralMode)"
    >
      <template #icon><RollModeBadge :mode="option.mode" variant="large" :show-caption="false" /></template>
    </ChoiceCard>
  </div>
</template>
<script setup>
import { ChoiceCard } from '@sylvieshare/share-ui'
import { layoutTokens } from '@/app/design-tokens'
import RollModeBadge from './RollModeBadge.vue'
defineProps({
  modelValue: { type: String, default: 'normal' },
  neutralMode: { type: String, default: 'normal' },
  disabled: Boolean,
})
const emit = defineEmits(['update:modelValue'])
const options = [
  { mode: 'disadvantage', label: 'Помеха', description: 'Меньший из 2к20', color: 'var(--danger)' },
  { mode: 'advantage', label: 'Преимущество', description: 'Больший из 2к20', color: 'var(--success)' },
]
</script>
<style scoped>
.roll-mode-picker { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--spacing-small); --choice-card-min-height: var(--layout-roll-mode-card-min-height); }
</style>
