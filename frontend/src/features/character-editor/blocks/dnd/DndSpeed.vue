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
      <NumBonusEditor title="Скорость" :data="numData" :extra="-speedPenalty" unit="фт" @change="onChange">
        <div v-if="speedPenalty" class="speed-armor-rule">−{{ speedPenalty }} фт. · {{ armorState.body.name }} требует Силу {{ armorState.strengthRequired }}</div>
      </NumBonusEditor>
    </template>
  </StatTile>
</template>

<script setup>
import { computed, inject } from 'vue'
import { sumBonuses } from '@/shared/lib/dnd'
import NumBonusEditor from '@/features/character-editor/blocks/dnd/components/NumBonusEditor'
import StatTile from '@/features/character-editor/blocks/dnd/components/StatTile'

const props = defineProps(['block', 'value'])
const emit = defineEmits(['update:value'])
const charCtx = inject('charCtx', {})

const variant = computed(() => props.block?.props?.variant || props.block?.content?.variant || '')
const iconSrc = computed(() => props.block?.content?.svg || null)

const numData = computed(() => {
  return props.value && typeof props.value === 'object'
    ? props.value
    : { base: 0, bonuses: [] }
})
const displayValue = computed(() => {
  const d = numData.value
  return (d.base || 0) + sumBonuses(d.bonuses) - speedPenalty.value
})
const armorState = computed(() => charCtx.characterArmor?.state || {})
const speedPenalty = computed(() => Number(armorState.value.speedPenalty) || 0)

function onChange(data) { emit('update:value', props.block.id, data) }
</script>

<style scoped>
.speed-armor-rule { padding: 8px 10px; border: 1px solid color-mix(in srgb, var(--warning) 45%, var(--border)); border-radius: 8px; background: color-mix(in srgb, var(--warning) 9%, transparent); color: var(--text-2); font-size: 11px; line-height: 1.4; }
</style>
