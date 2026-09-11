<template>
  <div class="ability-resource-fields">
    <template v-if="independent">
      <AbilityRuleFields :fields="fieldsFor(['title'])" :data="data" @update:data="update" />
      <RuleKeyField v-model="data.key" :title="data.title" :used-keys="otherKeys" />
    </template>
    <FormField label="Как считать использования" title="Выберите способ расчёта максимума ресурса." vertical>
      <FormSelect :value="mode" aria-label="Как считать использования" @update:value="changeMode">
        <option v-if="fields.some(f => f.key === 'initial_charges')" value="initial">Начальный запас экземпляра</option>
        <option value="fixed">Фиксированное число</option><option value="stat">От характеристики</option><option value="level">От уровня</option>
        <option v-if="fields.some(f => f.key === 'max_use_scaling')" value="scaling">Из прогрессии уровней</option>
        <option v-if="fields.some(f => f.key === 'manual_size')" value="manual">Вручную на листе</option>
      </FormSelect>
    </FormField>
    <template v-if="mode === 'initial'">
      <FormField label="Как определить начальный запас" title="Игрок задаёт запас при добавлении предмета. Результат сохраняется отдельно для каждого экземпляра." vertical>
        <FormSelect :value="data.initial_charges.mode" aria-label="Как определить начальный запас" @update:value="value => data.initial_charges = value === 'fixed' ? { mode: value, value: 1 } : { mode: value, formula: '1к8+1' }"><option value="fixed">Заданное число</option><option value="roll">Бросок костей</option></FormSelect>
      </FormField>
      <AbilityRuleFields :fields="fields.find(f => f.key === 'initial_charges').fields.filter(f => f.key === (data.initial_charges.mode === 'fixed' ? 'value' : 'formula'))" :data="data.initial_charges" @update:data="value => data.initial_charges = value" />
    </template>
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
    <template v-if="fields.some(field => field.key === 'dawn_recovery')">
      <FormField label="На рассвете" title="Отдельное событие в меню отдыха. Не восстанавливает ресурс при коротком или длинном отдыхе." vertical>
        <FormSelect :value="data.dawn_recovery?.mode || 'none'" aria-label="На рассвете" @update:value="setDawn"><option value="none">Не восстанавливать</option><option value="full">Восстановить полностью</option><option value="roll">Восстановить по формуле</option></FormSelect>
      </FormField>
      <FormField v-if="data.dawn_recovery?.mode === 'roll'" label="Формула восстановления" title="Например, 1к3 или 1к6+1. Итог ограничен максимумом ресурса." vertical><FormTextInput v-model:value="data.dawn_recovery.formula" placeholder="1к3" aria-label="Формула восстановления" /></FormField>
    </template>
    <AbilityUnlockField v-if="independent" :data="data" />
  </div>
</template>
<script setup>
import { initialChargeRuleError } from '@/shared/lib/itemInitialCharges'
import { validDawnFormula } from '@/features/character-editor/lib/dawnResources'
import { computed, inject, onScopeDispose, ref, watchEffect } from 'vue'
import { FormField, FormSelect, FormTextInput, ToggleSwitch } from '@sylvieshare/share-ui'
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
  initial: [], fixed: ['max_use'], manual: ['max_use'], stat: ['max_use_stat', 'max_use_stat_multiplier', 'max_use_bonus', 'max_use_min'],
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
function setDawn(mode) {
  if (mode === 'none') delete props.data.dawn_recovery
  else props.data.dawn_recovery = mode === 'full' ? { mode } : { mode, formula: '1к3' }
}
const validationKey = Symbol('resource')
watchEffect(() => {
  let error = ''
  if (props.independent && (!props.data.key || otherKeys.value.includes(props.data.key))) error = 'Отдельный ресурс: заполните уникальный ключ.'
  if (mode.value === 'initial') error = initialChargeRuleError(props.data.initial_charges) || (props.data.use_resources?.length ? 'Начальный запас используется как основной ресурс. Уберите отдельные ресурсы или выберите другой способ расчёта.' : '')
  if (mode.value === 'stat' && !props.data.max_use_stat) error = 'Ресурс: выберите характеристику для расчёта.'
  if (mode.value === 'scaling' && !editor.itemData?.scaling?.some(r => r.uses != null)) error = 'Ресурс: добавьте количество использований в развитие с уровнем.'
  if (props.data.dawn_recovery?.mode === 'roll' && !validDawnFormula(props.data.dawn_recovery.formula)) error = 'Рассвет: укажите число или формулу костей, например 1к3 или 1к6+1.'
  editor.setValidationError?.(validationKey, error)
})
onScopeDispose(() => editor.setValidationError?.(validationKey, ''))
</script>
