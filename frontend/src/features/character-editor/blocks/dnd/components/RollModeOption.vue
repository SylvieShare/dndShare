<template>
  <ChoiceCard layout="inline" selection-indicator="outline" :label="label" :color="color" :model-value="selected" :disabled="disabled"
    @update:model-value="emit('select', $event)">
    <template #icon><RollModeBadge :mode="mode" variant="marker" :show-caption="false" embedded /></template>
  </ChoiceCard>
</template>
<script setup>
import { computed } from 'vue'
import { ChoiceCard } from '@sylvieshare/share-ui'
import RollModeBadge from './RollModeBadge.vue'
const props = defineProps({ mode: { type: String, required: true }, selected: Boolean, disabled: Boolean })
const emit = defineEmits(['select'])
const label = computed(() => props.mode === 'advantage' ? 'Преимущество' : 'Помеха')
const color = computed(() => props.mode === 'advantage' ? 'var(--success)' : 'var(--danger)')
</script>
