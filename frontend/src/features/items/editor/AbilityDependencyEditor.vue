<template>
  <div class="ability-action-fields">
    <p v-if="manifest.summary" class="ability-block-hint">{{ manifest.summary(data) }}</p>
    <AbilityRuleFields :fields="fieldsFor(manifest.main(data))" :data="data" @update:data="update" />
    <AbilityDerivedTargets v-if="kind === 'derived_effects'" :data="data" />
    <template v-for="gate in gates" :key="gate.title">
      <FormField :label="gate.title" :title="gate.title">
        <ToggleSwitch :model-value="enabled[gate.title]" :aria-label="gate.title" @update:model-value="value => setGate(gate, value)" />
      </FormField>
      <div v-if="enabled[gate.title] && !booleanGate(gate)" class="ability-condition-fields">
        <AbilityRuleFields :fields="fieldsFor(gate.keys.filter(key => !['choice_values', 'choice_value_prefix'].includes(key)))" :data="data" @update:data="update" />
        <AbilityChoiceCondition v-if="gate.keys.includes('choice_values') && data.choice_key" :data="data" />
      </div>
    </template>
    <AbilityLevelSource v-if="kind === 'hp_bonuses' && enabled['Прибавка за уровень']" :data="editor.itemData || {}" readonly />
    <FormField v-if="kind === 'roll_triggers' && fields.some(f => f.key === 'use_key')" label="Расход при перебросе" title="Выберите применение этого предмета. Его ресурс и ожидание будут проверены при перебросе." vertical>
      <FormSelect :value="data.use_key || ''" aria-label="Расход при перебросе" @update:value="value => { if (value) data.use_key = value; else delete data.use_key }"><option value="">Без расхода</option><option v-for="use in editor.itemData?.confirmed_uses || []" :key="use.key" :value="use.key">{{ use.title }}</option></FormSelect>
    </FormField>
    <ItemRuleActivation v-if="fields.some(f => f.key === 'activation')" :data="data" />
    <AbilityUnlockField v-if="allowUnlock" :data="data" />
  </div>
</template>
<script setup>
import { computed, inject, onScopeDispose, reactive, watchEffect } from 'vue'
import ItemRuleActivation from './ItemRuleActivation.vue'
import { FormField, FormSelect, ToggleSwitch } from '@sylvieshare/share-ui'
import { itemFieldEditorKey } from '@/features/character-editor/components/useItemFieldEditor'
import { dependencyManifest, dependencyFields, changeDerivedKind } from './abilityDependencyManifest'
import { hasFieldValue } from './abilityEditorProfile'
import AbilityRuleFields from './AbilityRuleFields.vue'
import AbilityUnlockField from './AbilityUnlockField.vue'
import AbilityLevelSource from './AbilityLevelSource.vue'
import AbilityDerivedTargets from './AbilityDerivedTargets.vue'
import AbilityChoiceCondition from './AbilityChoiceCondition.vue'
const props = defineProps({ kind: String, data: Object, fields: Array, allowUnlock: { type: Boolean, default: true } })
const editor = inject(itemFieldEditorKey, {})
const manifest = computed(() => dependencyManifest[props.kind])
const enabled = reactive(Object.fromEntries(manifest.value.gates.map(g => [g.title, g.keys.some(k => k === 'allow_shield' ? props.data[k] === false : hasFieldValue(props.data[k]))])))
const gates = computed(() => manifest.value.gates.filter(g => !g.when || g.when(props.data)).map(g => ({ ...g, keys: g.keys.filter(key => !manifest.value.main(props.data).includes(key)) })).filter(g => fieldsFor(g.keys).length))
const fieldsFor = keys => dependencyFields(props.kind, props.fields, keys, props.data).filter(field => field.key !== 'event' || field.options?.length > 1)
const validationKey = Symbol('dependency')
watchEffect(() => {
  let error = ''
  if (props.kind === 'roll_triggers' && props.data.use_key && !editor.itemData?.confirmed_uses?.some(use => use.key === props.data.use_key)) error = 'Переброс: выберите существующее применение этого предмета.'
  if (props.kind === 'derived_effects' && !props.data.kind) error = 'Изменение показателя: выберите, что изменить.'
  if (props.kind === 'derived_effects' && enabled['Зависит от выбора игрока'] && !props.data.choice_key) error = 'Изменение показателя: выберите связанный выбор игрока.'
  if (props.kind === 'granted_spells' && !(props.data.spell?.id || props.data.spell)) error = 'Дарованное заклинание: выберите заклинание.'
  if (props.kind === 'defenses' && (!props.data.kind || !props.data.damage_type)) error = 'Защита: выберите вид защиты и тип урона.'
  editor.setValidationError?.(validationKey, error)
})
onScopeDispose(() => editor.setValidationError?.(validationKey, ''))
function update(value) {
  if (props.kind === 'derived_effects' && value.kind !== props.data.kind) changeDerivedKind(value, value.kind)
  if (value.choice_key !== props.data.choice_key) { delete value.choice_values; delete value.choice_value_prefix }
  if (value.target_from_choice && !props.data.target_from_choice) { delete value.target_ids; delete value.skill_ids }
  if (value.requires_armor && !props.data.requires_armor) delete value.requires_no_armor
  if (value.requires_no_armor && !props.data.requires_no_armor) delete value.requires_armor
  for (const key of Object.keys(props.data)) if (!(key in value)) delete props.data[key]
  Object.assign(props.data, value)
}
function booleanGate(gate) { return gate.keys.length === 1 && ['bool', 'boolean'].includes(fieldsFor(gate.keys)[0]?.type) }
function setGate(gate, value) {
  enabled[gate.title] = value
  if (value && booleanGate(gate)) props.data[gate.keys[0]] = true
  if (!value) for (const key of gate.keys) delete props.data[key]
}
</script>
