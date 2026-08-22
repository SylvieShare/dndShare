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
      <NumBonusEditor title="Инициатива" :data="numData" :extra="dexExtra" :pre="displayValue > 0 ? '+' : ''" @change="onChange">
        <ToggleSwitch
          v-if="dexMod !== null"
          :modelValue="numData.use_dex || false"
          :label="`Учитывать ловкость (${dexMod >= 0 ? '+' : ''}${dexMod})`"
          @update:modelValue="setUseDex"
        />
      </NumBonusEditor>
    </template>
  </StatTile>
</template>

<script setup>
import { computed, inject } from 'vue'
import { abilityModByPath, sumBonuses } from '@/shared/lib/dnd'
import NumBonusEditor from '@/features/character-editor/blocks/dnd/components/NumBonusEditor'
import StatTile from '@/features/character-editor/blocks/dnd/components/StatTile'
import { ToggleSwitch } from '@sylvieshare/share-ui'
import { useDiceStore } from '@/stores/dice'

const props = defineProps(['block', 'value', 'values'])
const emit = defineEmits(['update:value'])
const charCtx = inject('charCtx', {})

const diceStore = useDiceStore()

const variant = computed(() => props.block?.props?.variant || props.block?.content?.variant || '')
const iconSrc = computed(() => props.block?.content?.svg || null)

const numData = computed(() => {
  if (props.value && typeof props.value === 'object') return props.value
  return { base: parseInt(props.value) || 0, bonuses: [] }
})
const dexMod = computed(() => abilityModByPath(props.values, props.block.content?.dex_mod_path))
const dexExtra = computed(() => (numData.value.use_dex && dexMod.value !== null ? dexMod.value : 0))
const displayValue = computed(() => {
  const d = numData.value
  return (d.base || 0) + sumBonuses(d.bonuses) + dexExtra.value
})

function onChange(data) { emit('update:value', props.block.id, data) }
function setUseDex(v) { emit('update:value', props.block.id, { ...numData.value, use_dex: v }) }

function rollInit() {
  diceStore.rollD20('Инициатива', displayValue.value, 'normal', {
    crit_mode: true,
    roll_triggers: charCtx.characterCombatEffects?.rollTriggers?.('ability_check') || [],
  })
}
</script>
