<template>
  <div class="ability-resource-fields">
    <FormField label="Как считать использования" :title="mode === 'scaling' ? 'Количество использований берётся из блока «Прогрессия по уровням».' : 'Выберите один способ расчёта максимума ресурса.'" vertical>
      <FormSelect :value="mode" aria-label="Как считать использования" @update:value="changeMode">
        <option value="fixed">Фиксированное число</option>
        <option value="stat">От характеристики</option>
        <option value="level">От уровня</option>
        <option value="scaling">Из прогрессии уровней</option>
        <option value="manual">Вручную на листе</option>
      </FormSelect>
    </FormField>
    <AbilityRuleFields :fields="visibleFields" :data="data" @update:data="value => Object.assign(data, value)" />
    <details v-if="additionalFields.length" class="ability-advanced" :open="hasAdditionalValues || undefined">
      <summary>Особые правила восстановления и отдельные ресурсы</summary>
      <AbilityRuleFields :fields="additionalFields" :data="data" @update:data="value => Object.assign(data, value)" />
    </details>
  </div>
</template>
<script setup>
import { computed, ref } from 'vue'
import { FormField, FormSelect } from '@sylvieshare/share-ui'
import AbilityRuleFields from './AbilityRuleFields.vue'
import { abilityResourceMode, changeAbilityResourceMode, hasFieldValue } from './abilityEditorProfile'

const props = defineProps({ fields: { type: Array, required: true }, data: { type: Object, required: true } })
const mode = ref(abilityResourceMode(props.data))
const calculationKeys = {
  fixed: ['max_use'], manual: ['max_use'], stat: ['max_use_stat', 'max_use_stat_multiplier', 'max_use_bonus', 'max_use_min'],
  level: ['max_use_level_multiplier', 'max_use_bonus', 'max_use_min'], scaling: [],
}
const mainKeys = computed(() => [...calculationKeys[mode.value], 'resource_color', 'rollback_short_rest', 'rollback_long_rest'])
const visibleFields = computed(() => props.fields.filter(field => mainKeys.value.includes(field.key)))
const additionalFields = computed(() => props.fields.filter(field => ['rollback_short_rest_level', 'short_rest_recovery', 'short_rest_recovery_level', 'use_resources'].includes(field.key)))
const hasAdditionalValues = computed(() => additionalFields.value.some(field => hasFieldValue(props.data[field.key])))
function changeMode(value) { mode.value = value; changeAbilityResourceMode(props.data, value) }
</script>
