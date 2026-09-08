<template>
  <FormField label="Ключ" vertical :title="manual ? 'Ключ задан вручную и не меняется при переименовании. Пустое значение тоже сохраняется. При изменении ключа обновите ссылки на него.' : 'Заполняется из названия. Можно изменить вручную; после этого автоматическое обновление отключится.'">
    <FormTextInput :value="modelValue || ''" aria-label="Ключ" :placeholder="generatedKey || 'Заполнится из названия'" @update:value="setManually" />
  </FormField>
</template>
<script setup>
import { FormField, FormTextInput } from '@sylvieshare/share-ui'
import { useRuleKey } from './useRuleKey'
const props = defineProps({ modelValue: { default: undefined }, title: String, usedKeys: { type: Array, default: () => [] } })
const emit = defineEmits(['update:modelValue'])
const { manual, generatedKey, setManually } = useRuleKey(props, emit)
</script>
