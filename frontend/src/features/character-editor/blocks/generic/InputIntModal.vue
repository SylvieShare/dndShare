<template>
  <AppModal @close="$emit('close')">
    <div class="im-title">{{ title || 'Значение' }}</div>
    <FormField label="Основное значение">
      <FormNumberInput :value="data.base" @change="setBase" />
    </FormField>
    <BonusList :bonuses="data.bonuses || []" @update:bonuses="v => emit('change', { ...data, bonuses: v })" />
    <slot />
    <EditorTotal>Итого: <strong>{{ total }}</strong></EditorTotal>
  </AppModal>
</template>

<script setup>
import { computed } from 'vue'
import { sumBonuses } from '@/shared/lib/dnd'
import BonusList from '@/shared/ui/BonusList'
import AppModal from '@/shared/ui/AppModal'
import EditorTotal from '@/features/character-editor/components/EditorTotal'
import FormField from '@/shared/ui/form/FormField'
import FormNumberInput from '@/shared/ui/form/FormNumberInput'

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

<style scoped>
.im-title {
  color: var(--text-1);
  font-size: 16px;
  font-weight: 700;
  padding-right: 24px;
}
</style>
