<template>
  <ChoiceCard layout="icon" tinted centered selection-indicator="outline" :label="label" :color="color" :model-value="selected" :disabled="disabled"
    :style="{ '--choice-card-icon-size': `${layoutTokens['roll-mode-menu-die']}px`, '--choice-card-label-size': 'var(--type-roll-mode-option-size)', '--choice-card-label-line-height': 'var(--type-roll-mode-option-line-height)' }"
    @update:model-value="emit('select', $event)">
    <template #icon><RollModeBadge :mode="mode" variant="large" :show-caption="false" embedded /></template>
  </ChoiceCard>
</template>
<script setup>
import { computed } from 'vue'
import { ChoiceCard } from '@sylvieshare/share-ui'
import { layoutTokens } from '@/app/design-tokens'
import RollModeBadge from './RollModeBadge.vue'
const props = defineProps({ mode: { type: String, required: true }, selected: Boolean, disabled: Boolean })
const emit = defineEmits(['select'])
const label = computed(() => props.mode === 'advantage' ? 'Преимущество' : 'Помеха')
const color = computed(() => props.mode === 'advantage' ? 'var(--success)' : 'var(--danger)')
</script>
