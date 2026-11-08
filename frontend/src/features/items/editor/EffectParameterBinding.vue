<template>
  <div class="ability-action-fields" role="group" :aria-label="parameter.label">
    <FormField :label="parameter.label" vertical title="При наложении эффект получает число из выбранного источника.">
      <FormSelect :value="binding?.source || ''" :aria-label="`Источник значения · ${parameter.label}`" @update:value="source => setEffectParameter(data, parameter.key, source)">
        <option value="">По умолчанию</option>
        <option v-for="source in sources" :key="source.value" :value="source.value">{{ source.label }}</option>
        <option v-if="binding && !sources.some(source => source.value === binding.source)" :value="binding.source">Недоступный источник ({{ binding.source }})</option>
      </FormSelect>
    </FormField>
    <AbilityRuleFields v-if="binding" :fields="effectBindingFields(binding.source)" :data="binding" @update:data="update" />
    <p v-if="calculatedEffectSources.includes(binding?.source)" class="ability-block-hint">Начальное значение + число полных шагов × прибавка за шаг. Затем применяются минимум и максимум.</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { FormField, FormSelect } from '@sylvieshare/share-ui'
import AbilityRuleFields from './AbilityRuleFields.vue'
import { setEffectParameter } from './effectParameterOptions'
import { calculatedEffectSources, effectBindingFields } from './effectBindingFields'

const props = defineProps({ parameter: Object, data: Object, sources: Array })
const binding = computed(() => props.data.parameter_bindings?.find(row => row.key === props.parameter.key))
function update(value) { setEffectParameter(props.data, props.parameter.key, value.source, value) }
</script>
