<template>
  <StatTile
    :variant="variant"
    label="Скорость"
    mini-label="Скор."
    :value="displayValue"
    unit="фт"
    :icon="iconSrc"
  >
    <template #editor>
      <NumBonusEditor title="Скорость" :data="numData" unit="фт" @change="onChange" />
    </template>
  </StatTile>
</template>

<script setup>
import { computed } from 'vue'
import NumBonusEditor from '@/features/character-editor/blocks/dnd/components/NumBonusEditor'
import StatTile from '@/features/character-editor/blocks/dnd/components/StatTile'

const props = defineProps(['block', 'value'])
const emit = defineEmits(['update:value'])

const variant = computed(() => props.block?.props?.variant || props.block?.content?.variant || '')
const iconSrc = computed(() => props.block?.content?.svg || null)

const numData = computed(() => {
  if (props.value && typeof props.value === 'object') return props.value
  return { base: parseInt(props.value) || 0, bonuses: [] }
})
const displayValue = computed(() => {
  const d = numData.value
  return (d.base || 0) + (d.bonuses || []).reduce((s, b) => s + (parseInt(b.value) || 0), 0)
})

function onChange(data) { emit('update:value', props.block.id, data) }
</script>
