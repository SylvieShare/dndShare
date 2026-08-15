<template>
  <AppModalFrame :title="title || 'Значение'" @close="$emit('close')">
    <FormField label="Основное значение">
      <FormNumberInput :value="data.base" @change="setBase" />
    </FormField>
    <BonusList :bonuses="data.bonuses || []" @update:bonuses="v => emit('change', { ...data, bonuses: v })" />
    <slot />
    <EditorTotal>Итого: <strong>{{ total }}</strong></EditorTotal>
  </AppModalFrame>
</template>

<script setup>
import { computed } from 'vue'
import { sumBonuses } from '@/shared/lib/dnd'
import BonusList from '@/shared/ui/BonusList'
import { AppModalFrame } from '@sylvieshare/share-ui'
import { EditorTotal } from '@sylvieshare/share-ui'
import { FormField } from '@sylvieshare/share-ui'
import { FormNumberInput } from '@sylvieshare/share-ui'

const props = defineProps({
  data:  { type: Object, required: true },
  title: { type: String, default: '' },
})
const emit = defineEmits(['close', 'change'])
const total = computed(() => (props.data.base || 0) + sumBonuses(props.data.bonuses))

function setBase(v) {
  emit('change', { ...props.data, base: v })
}
</script>
