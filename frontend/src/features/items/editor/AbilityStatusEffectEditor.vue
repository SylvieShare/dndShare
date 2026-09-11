<template>
  <div class="ability-action-fields">
    <AbilityRuleFields :fields="fields.filter(field => field.key === 'effect')" :data="data" @update:data="pickEffect" />
    <RuleKeyField v-model="data.key" :title="effect?.name" :used-keys="otherKeys" />
    <AbilityRuleFields :fields="fields.filter(field => ['target', 'condition'].includes(field.key))" :data="data" @update:data="value => Object.assign(data, value)" />
    <FormField v-if="damageRules.length || data.weapon_damage_key" label="Связанный дополнительный урон" title="Указывает, с каким переключателем урона связан эффект. Спасбросок и наложение на цель игрок проверяет отдельно." vertical>
      <FormSelect :value="data.weapon_damage_key || ''" aria-label="Связанный дополнительный урон" @update:value="value => data.weapon_damage_key = value || undefined">
        <option value="">Не связан с уроном оружия</option>
        <option v-for="rule in damageRules" :key="rule.key" :value="rule.key">{{ rule.label || rule.key }} · Дополнительный урон</option>
        <option v-if="data.weapon_damage_key && !damageRules.some(row => row.key === data.weapon_damage_key)" :value="data.weapon_damage_key">Недоступное правило: {{ data.weapon_damage_key }}</option>
      </FormSelect>
    </FormField>
    <LoadingIndicator v-if="loading" label="Загрузка настроек эффекта…" size="xs" inline show-label />
    <button v-if="error" type="button" class="ability-link" @click="loadEffect">Не удалось загрузить эффект. Повторить</button>
    <div v-for="parameter in parameters" :key="parameter.key" class="ability-action-fields">
      <FormField :label="parameter.label" vertical :title="`Параметр эффекта ${parameter.key}. Значение можно брать из прогрессии этой способности.`">
        <FormSelect :value="binding(parameter.key)?.source || ''" :aria-label="parameter.label" @update:value="source => setEffectParameter(data, parameter.key, source)">
          <option value="">Как в самом эффекте</option><option v-if="allowScaling" value="scaling_value">Из прогрессии способности</option><option value="fixed">Задать число</option>
        </FormSelect>
      </FormField>
      <FormField v-if="binding(parameter.key)?.source === 'fixed'" label="Значение" vertical :title="`Постоянное значение: ${parameter.label}.`"><FormTextInput :value="binding(parameter.key).value" type="number" :aria-label="`Значение: ${parameter.label}`" @update:value="value => setEffectParameter(data, parameter.key, 'fixed', Number(value))" /></FormField>
    </div>
    <FormField label="Своя длительность" title="Если выключено, используется длительность из справочника эффектов."><ToggleSwitch :model-value="!!data.duration" aria-label="Своя длительность" @update:model-value="setDuration" /></FormField>
    <AbilityRuleFields v-if="data.duration" :fields="durationFields" :data="data.duration" @update:data="updateDuration" />
    <AbilityRuleFields :fields="fields.filter(field => field.key === 'concentration')" :data="data" @update:data="value => Object.assign(data, value)" />
  </div>
</template>
<script setup>
import { LoadingIndicator } from '@sylvieshare/share-ui'
import { computed, inject, onScopeDispose, ref, watch, watchEffect } from 'vue'
import { FormField, FormSelect, FormTextInput, ToggleSwitch } from '@sylvieshare/share-ui'
import { itemsApi } from '@/shared/api/itemsApi'
import { itemFieldEditorKey } from '@/features/character-editor/components/useItemFieldEditor'
import AbilityRuleFields from './AbilityRuleFields.vue'
import RuleKeyField from './RuleKeyField.vue'
import { effectParameterOptions, setEffectParameter } from './effectParameterOptions'
const props = defineProps({ data: Object, fields: Array, allowScaling: { type: Boolean, default: true } })
const editor = inject(itemFieldEditorKey, {})
const effect = ref(null), loading = ref(false), error = ref(false)
let request = 0
const effectId = computed(() => props.data.effect?.id ?? props.data.effect)
const parameters = computed(() => effectParameterOptions(effect.value, props.data.parameter_bindings))
const binding = key => props.data.parameter_bindings?.find(row => row.key === key)
const otherKeys = computed(() => (editor.itemData?.status_effects || []).filter(row => row !== props.data).map(row => row.key))
const damageRules = computed(() => (editor.itemData?.weapon_damage || []).filter(row => row.key))
const durationFields = computed(() => (props.fields.find(field => field.key === 'duration')?.fields || [])
  .filter(field => field.key !== 'value' || ['rounds', 'minutes', 'hours'].includes(props.data.duration?.kind)))
function setDuration(enabled) { if (enabled) props.data.duration = { kind: 'minutes', value: 1 }; else delete props.data.duration }
function updateDuration(value) { if (!['rounds', 'minutes', 'hours'].includes(value.kind)) delete value.value; props.data.duration = value }
function pickEffect(value) {
  const id = value.effect?.id ?? value.effect
  if (id !== effectId.value) delete props.data.parameter_bindings
  props.data.effect = value.effect
}
async function loadEffect() {
  const version = ++request
  effect.value = null; error.value = false
  if (!effectId.value) { loading.value = false; return }
  loading.value = true
  try { const response = await itemsApi.byIds([effectId.value]); if (version === request) effect.value = response.items?.[0] || null }
  catch { if (version === request) error.value = true }
  finally { if (version === request) loading.value = false }
}
const validationKey = Symbol('status-link')
watchEffect(() => {
  let message = !effectId.value ? 'Связанный эффект: выберите эффект из справочника.' : ''
  if (props.data.weapon_damage_key && !damageRules.value.some(row => row.key === props.data.weapon_damage_key)) message = 'Связанный эффект: выберите существующее правило дополнительного урона.'
  if (props.data.parameter_bindings?.some(row => row.source === 'scaling_value') && !editor.itemData?.scaling?.length) message = 'Связанный эффект: добавьте таблицу развития с уровнем для расчёта параметров.'
  if (['rounds', 'minutes', 'hours'].includes(props.data.duration?.kind) && !(Number(props.data.duration.value) > 0)) message = 'Длительность эффекта должна быть больше нуля.'
  editor.setValidationError?.(validationKey, message)
})
watch(effectId, loadEffect, { immediate: true })
onScopeDispose(() => { request++; editor.setValidationError?.(validationKey, '') })
</script>
