<template>
  <EditorPanel :title="title">
    <FormField label="Основное значение">
      <FormNumberInput :value="data.base" :min="min" :max="max" @change="setBase" />
    </FormField>
    <slot></slot>
    <BonusList :bonuses="data.bonuses || []" @update:bonuses="setBonuses" />
    <EditorTotal>Итого: <strong>{{ pre }}{{ total }}{{ unit ? ' ' + unit : '' }}</strong></EditorTotal>
  </EditorPanel>
</template>

<script setup>
import { computed } from 'vue'
import { sumBonuses } from '@/shared/lib/dnd'
import BonusList from '@/shared/ui/BonusList'
import { EditorPanel } from '@sylvieshare/share-ui'
import { EditorTotal } from '@sylvieshare/share-ui'
import { FormField } from '@sylvieshare/share-ui'
import { FormNumberInput } from '@sylvieshare/share-ui'

// Right-column editor for simple "base value + bonuses" tiles (initiative, speed). Emits the full
// data object (`{ base, bonuses, value }`) on every change.
const props = defineProps({
  title: { type: String, default: '' },
  data: { type: Object, default: () => ({ base: 0, bonuses: [] }) },
  min: { default: undefined },
  max: { default: undefined },
  pre: { type: String, default: '' },
  unit: { type: String, default: '' },
  extra: { type: Number, default: 0 },
})
const emit = defineEmits(['change'])

const total = computed(() => (props.data.base || 0) + sumBonuses(props.data.bonuses) + props.extra)

function commit(next) {
  const base = parseInt(next.base) || 0
  const bonuses = Array.isArray(next.bonuses) ? next.bonuses : []
  const value = base + sumBonuses(bonuses)
  emit('change', { ...next, base, bonuses, value })
}
function setBase(v) { commit({ ...props.data, base: v }) }
function setBonuses(v) { commit({ ...props.data, bonuses: v }) }
</script>
