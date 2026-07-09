<template>
  <EditorPanel :title="title">
    <FormField label="Основное значение">
      <FormNumberInput :value="data.base" :min="min" :max="max" @change="setBase" />
    </FormField>
    <BonusList :bonuses="data.bonuses || []" @update:bonuses="setBonuses" />
    <EditorTotal>Итого: <strong>{{ pre }}{{ total }}{{ unit ? ' ' + unit : '' }}</strong></EditorTotal>
  </EditorPanel>
</template>

<script setup>
import { computed } from 'vue'
import BonusList from '@/shared/ui/BonusList'
import EditorPanel from '@/features/character-editor/components/EditorPanel'
import EditorTotal from '@/features/character-editor/components/EditorTotal'
import FormField from '@/shared/ui/form/FormField'
import FormNumberInput from '@/shared/ui/form/FormNumberInput'

// Right-column editor for simple "base value + bonuses" tiles (initiative, speed). Emits the full
// data object (`{ base, bonuses, value }`) on every change.
const props = defineProps({
  title: { type: String, default: '' },
  data: { type: Object, default: () => ({ base: 0, bonuses: [] }) },
  min: { default: undefined },
  max: { default: undefined },
  pre: { type: String, default: '' },
  unit: { type: String, default: '' },
})
const emit = defineEmits(['change'])

const total = computed(() =>
  (props.data.base || 0) + (props.data.bonuses || []).reduce((s, b) => s + (parseInt(b.value) || 0), 0)
)

function commit(next) {
  const base = parseInt(next.base) || 0
  const bonuses = Array.isArray(next.bonuses) ? next.bonuses : []
  const value = base + bonuses.reduce((s, b) => s + (parseInt(b.value) || 0), 0)
  emit('change', { ...next, base, bonuses, value })
}
function setBase(v) { commit({ ...props.data, base: v }) }
function setBonuses(v) { commit({ ...props.data, bonuses: v }) }
</script>
