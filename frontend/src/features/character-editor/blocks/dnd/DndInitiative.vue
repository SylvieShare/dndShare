<template>
  <StatTile
    :variant="variant"
    label="Инициатива"
    mini-label="Иниц."
    :value="displayValue"
    :pre="displayValue > 0 ? '+' : ''"
    :icon="iconSrc"
    rollable
    @action="rollInit"
  >
    <template #editor>
      <NumBonusEditor title="Инициатива" :data="numData" :pre="displayValue > 0 ? '+' : ''" @change="onChange" />
    </template>
  </StatTile>
</template>

<script setup>
import { computed } from 'vue'
import { d20Expr } from '@/shared/lib/dnd'
import NumBonusEditor from '@/features/character-editor/blocks/dnd/components/NumBonusEditor'
import StatTile from '@/features/character-editor/blocks/dnd/components/StatTile'
import { useDiceStore } from '@/stores/dice'

const props = defineProps(['block', 'value'])
const emit = defineEmits(['update:value'])

const diceStore = useDiceStore()

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

function rollInit() {
  const b = displayValue.value
  const expr = d20Expr(b)
  diceStore.roll('Инициатива', expr, { crit_mode: true })
}
</script>
