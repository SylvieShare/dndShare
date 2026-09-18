<template>
  <div class="action-time-editor">
    <FormField :label="label" vertical title="Вид действия, время или свой вариант.">
      <FormSelect :value="modelValue?.kind || ''" :aria-label="label" @update:value="kind => $emit('update:modelValue', kind ? { kind, ...(TIME_UNITS[kind] ? { value: 1 } : {}) } : undefined)">
        <option value="">Не задано</option>
        <option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option>
      </FormSelect>
    </FormField>
    <FormField v-if="TIME_UNITS[modelValue?.kind]" label="Количество" vertical title="Длительность действия."><FormTextInput type="number" min="1" step="1" :value="modelValue.value ?? ''" aria-label="Количество времени" @update:value="value => patch({ value: value === '' ? null : Number(value) })" /></FormField>
    <FormField v-if="modelValue?.kind === 'custom'" label="Своё время" vertical title="Особое время или несколько вариантов."><FormTextInput :value="modelValue.text || ''" aria-label="Своё время" @update:value="text => patch({ text })" /></FormField>
    <FormField v-if="modelValue?.kind === 'reaction'" label="Условие реакции" vertical title="На какое событие можно ответить этой реакцией."><FormTextInput :value="modelValue.condition || ''" aria-label="Условие реакции" @update:value="condition => patch({ condition })" /></FormField>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import { FormField, FormSelect, FormTextInput } from '@sylvieshare/share-ui'
import { TIME_UNITS, ACTION_TYPES } from '@/shared/lib/spellPresentation'
const props = defineProps({ modelValue: Object, label: { type: String, default: 'Время сотворения' }, timedOnly: Boolean })
const emit = defineEmits(['update:modelValue'])
const options = computed(() => [...(props.timedOnly ? [] : ACTION_TYPES.filter(row => row.value !== 'timed')), ...Object.entries({ rounds: 'Раунды', minutes: 'Минуты', hours: 'Часы', days: 'Дни', custom: 'Своё значение' }).map(([value, label]) => ({ value, label }))])
const patch = value => emit('update:modelValue', { ...props.modelValue, ...value })
</script>
<style scoped>
.action-time-editor { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
</style>
