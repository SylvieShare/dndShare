<template>
  <div class="ability-resource-fields">
    <template v-if="independent">
      <AbilityRuleFields :fields="fieldsFor(['title'])" :data="data" @update:data="update" />
      <RuleKeyField v-model="data.key" :title="data.title" :used-keys="otherKeys" />
    </template>
    <FormField label="Как считать использования" title="Выберите способ расчёта максимума ресурса." vertical>
      <FormSelect :value="mode" aria-label="Как считать использования" @update:value="changeMode">
        <option value="fixed">Фиксированное число</option><option value="stat">От характеристики</option><option value="level">От уровня</option>
        <option v-if="fields.some(f => f.key === 'max_use_scaling')" value="scaling">Из прогрессии уровней</option>
        <option v-if="fields.some(f => f.key === 'manual_size')" value="manual">Вручную на листе</option>
      </FormSelect>
    </FormField>
    <AbilityRuleFields :fields="fieldsFor(calculationKeys[mode])" :data="data" @update:data="update" />
    <AbilityLevelSource v-if="['level', 'scaling'].includes(mode)" :data="editor.itemData || data" readonly />
    <AbilityRuleFields :fields="fieldsFor(['resource_color', 'rollback_long_rest'])" :data="data" @update:data="update" />
    <FormField label="После короткого отдыха" title="Восстановить все использования, часть или ничего." vertical>
      <FormSelect :value="restMode" aria-label="После короткого отдыха" @update:value="changeRest"><option value="none">Не восстанавливать</option><option value="full">Восстановить полностью</option><option v-if="fields.some(f => f.key === 'short_rest_recovery')" value="partial">Восстановить часть</option></FormSelect>
    </FormField>
    <AbilityRuleFields v-if="restMode === 'partial'" :fields="fieldsFor(['short_rest_recovery'])" :data="data" @update:data="update" />
    <template v-if="restMode !== 'none' && fields.some(f => f.key === restLevelKey)">
      <FormField label="Восстановление открывается позже" title="До указанного уровня короткий отдых не восстанавливает этот ресурс."><ToggleSwitch v-model="restLater" aria-label="Восстановление открывается позже" @update:model-value="setRestLater" /></FormField>
      <AbilityRuleFields v-if="restLater" :fields="fieldsFor([restLevelKey])" :data="data" @update:data="update" />
    </template>
    <AbilityUnlockField v-if="independent" :data="data" />
  </div>
</template>
<script setup>
import { computed, inject, onScopeDispose, ref, watchEffect } from 'vue'
import { FormField, FormSelect, ToggleSwitch } from '@sylvieshare/share-ui'
import { itemFieldEditorKey } from '@/features/character-editor/components/useItemFieldEditor'
import AbilityRuleFields from './AbilityRuleFields.vue'
import AbilityLevelSource from './AbilityLevelSource.vue'
import AbilityUnlockField from './AbilityUnlockField.vue'
import RuleKeyField from './RuleKeyField.vue'
import { abilityResourceMode, changeAbilityResourceMode } from './abilityEditorProfile'
const props = defineProps({ fields: { type: Array, required: true }, data: { type: Object, required: true }, independent: Boolean })
const editor = inject(itemFieldEditorKey, {})
const mode = ref(abilityResourceMode(props.data))
const restMode = ref(props.data.rollback_short_rest ? 'full' : props.data.short_rest_recovery ? 'partial' : 'none')
const restLater = ref(!!(props.data.rollback_short_rest_level || props.data.short_rest_recovery_level))
const restLevelKey = computed(() => restMode.value === 'full' ? 'rollback_short_rest_level' : 'short_rest_recovery_level')
const otherKeys = computed(() => (editor.itemData?.use_resources || []).filter(r => r !== props.data).map(r => r.key))
const calculationKeys = {
  fixed: ['max_use'], manual: ['max_use'], stat: ['max_use_stat', 'max_use_stat_multiplier', 'max_use_bonus', 'max_use_min'],
  level: ['max_use_level_multiplier', 'max_use_bonus', 'max_use_min'], scaling: [],
}
const labels = { max_use: 'Максимум использований', max_use_level_multiplier: 'Использований за уровень', short_rest_recovery: 'Сколько восстановить', rollback_long_rest: 'Полностью восстановить после продолжительного отдыха' }
const fieldsFor = keys => keys.map(key => props.fields.find(f => f.key === key)).filter(Boolean).map(f => ({ ...f, name: labels[f.key] || f.name }))
function update(value) { Object.assign(props.data, value) }
function changeMode(value) {
  mode.value = value
  changeAbilityResourceMode(props.data, value)
  const allowed = new Set(calculationKeys[value])
  for (const key of Object.values(calculationKeys).flat()) if (!allowed.has(key)) delete props.data[key]
}
function changeRest(value) {
  restMode.value = value; restLater.value = false
  for (const key of ['rollback_short_rest', 'rollback_short_rest_level', 'short_rest_recovery', 'short_rest_recovery_level']) delete props.data[key]
  if (value === 'full') props.data.rollback_short_rest = true
  if (value === 'partial') props.data.short_rest_recovery = 1
}
function setRestLater(value) {
  if (value) props.data[restLevelKey.value] = Math.min(20, (Number(editor.itemData?.level) || 1) + 1)
  else delete props.data[restLevelKey.value]
}
const validationKey = Symbol('resource')
watchEffect(() => {
  let error = ''
  if (props.independent && (!props.data.key || otherKeys.value.includes(props.data.key))) error = 'Отдельный ресурс: заполните уникальный ключ.'
  if (mode.value === 'stat' && !props.data.max_use_stat) error = 'Ресурс: выберите характеристику для расчёта.'
  if (mode.value === 'scaling' && !editor.itemData?.scaling?.some(r => r.uses != null)) error = 'Ресурс: добавьте количество использований в развитие с уровнем.'
  editor.setValidationError?.(validationKey, error)
})
onScopeDispose(() => editor.setValidationError?.(validationKey, ''))
</script>
