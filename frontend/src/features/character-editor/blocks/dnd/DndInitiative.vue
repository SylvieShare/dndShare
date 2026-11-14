<template>
  <StatTile
    ref="tile"
    :editor-only="block.props?.editorOnly"
    :variant="variant"
    :embedded="block.props?.embedded"
    label="Инициатива"
    mini-label="Иниц."
    :value="displayValue"
    :pre="displayValue > 0 ? '+' : ''"
    :icon="iconSrc"
    rollable
    @action="rollInit"
  >
    <template #editor>
      <NumBonusEditor summary-in-header :data="numData" :extra="dexExtra" :pre="displayValue > 0 ? '+' : ''" @change="onChange">
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
import { computed, inject, ref } from 'vue'
import { initiativeSummary } from '@/features/character-editor/lib/utilityValues'
import NumBonusEditor from '@/features/character-editor/blocks/dnd/components/NumBonusEditor'
import StatTile from '@/features/character-editor/blocks/dnd/components/StatTile'
import { ToggleSwitch } from '@sylvieshare/share-ui'
import { useDiceStore } from '@/stores/dice'

const props = defineProps(['block', 'value', 'values'])
const emit = defineEmits(['update:value'])
const charCtx = inject('charCtx', {})
const tile = ref(null)
defineExpose({ open: () => tile.value?.open(), action: () => rollInit() })

const diceStore = useDiceStore()

const variant = computed(() => props.block?.props?.variant || props.block?.content?.variant || '')
const iconSrc = computed(() => props.block?.content?.svg || null)

const summary = computed(() => initiativeSummary(props.value, props.values, charCtx, props.block.content?.dex_mod_path ?? null))
const numData = computed(() => summary.value.data)
const dexMod = computed(() => summary.value.dexMod)
const dexExtra = computed(() => summary.value.dexExtra)
const displayValue = computed(() => summary.value.total)

function onChange(data) { emit('update:value', props.block.id, data) }
function setUseDex(v) { emit('update:value', props.block.id, { ...numData.value, use_dex: v }) }

function rollInit() {
  const resolved = charCtx.characterRolls?.resolve?.('auto', { kind: 'initiative', abilitySuggestId: 2 })
  diceStore.rollD20('Инициатива', displayValue.value, resolved?.mode || 'normal', {
    eventData: { sheetInitiative: true, ability: { id: 2, typeId: 16, name: 'Ловкость' } },
    crit_mode: true,
    roll_triggers: charCtx.characterCombatEffects?.rollTriggers?.('initiative') || [],
  })
}
</script>
