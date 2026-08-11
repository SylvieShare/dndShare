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
import { sumBonuses } from '@/shared/lib/dnd'
import NumBonusEditor from '@/features/character-editor/blocks/dnd/components/NumBonusEditor'
import StatTile from '@/features/character-editor/blocks/dnd/components/StatTile'

const props = defineProps(['block', 'value'])
const emit = defineEmits(['update:value'])

const variant = computed(() => props.block?.props?.variant || props.block?.content?.variant || '')
const iconSrc = computed(() => props.block?.content?.svg || null)

const numData = computed(() => {
  return props.value && typeof props.value === 'object'
    ? props.value
    : { base: 0, bonuses: [] }
})
const displayValue = computed(() => {
  const d = numData.value
  return (d.base || 0) + sumBonuses(d.bonuses)
})

function onChange(data) { emit('update:value', props.block.id, data) }
</script>
