<template>
  <div class="ability-rule-fields">
    <AbilityRuleField v-for="field in basicFields" :key="field.key" :field="field" :context-data="data" :hide-label="field.key === hideLabelFor" :model-value="data[field.key]" @update:model-value="value => update(field.key, value)" />
    <details v-if="advancedFields.length" class="ability-advanced" :open="hasAdvancedValues || undefined">
      <summary>Дополнительные настройки <span>{{ advancedFields.length }}</span></summary>
      <div class="ability-rule-fields">
        <AbilityRuleField v-for="field in advancedFields" :key="field.key" :field="field" :context-data="data" :hide-label="field.key === hideLabelFor" :model-value="data[field.key]" @update:model-value="value => update(field.key, value)" />
      </div>
    </details>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import AbilityRuleField from './AbilityRuleField.vue'
import { advancedAbilityField, hasFieldValue } from './abilityEditorProfile'
import { isFieldVisible } from '@/features/handbook/objects/lib/schemaFields'

const props = defineProps({ fields: { type: Array, default: () => [] }, data: { type: Object, default: () => ({}) }, advanced: Boolean, hideLabelFor: { type: String, default: '' } })
const emit = defineEmits(['update:data'])
const visibleFields = computed(() => props.fields.filter(field => !field.readonly && isFieldVisible(field, props.data)))
const basicFields = computed(() => visibleFields.value.filter(field => !props.advanced || !advancedAbilityField(field)))
const advancedFields = computed(() => props.advanced ? visibleFields.value.filter(advancedAbilityField) : [])
const hasAdvancedValues = computed(() => advancedFields.value.some(field => hasFieldValue(props.data[field.key]) && props.data[field.key] !== field.default))
function update(key, value) { emit('update:data', { ...props.data, [key]: value }) }
</script>
