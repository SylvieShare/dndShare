<template>
  <div class="ability-action-fields">
    <AbilityRuleFields v-if="kind === 'sheet_widgets'" :fields="fieldsFor(['title'])" :data="data" @update:data="update" />
    <RuleKeyField v-if="kind === 'sheet_widgets' && data.kind !== 'note'" v-model="data.key" :title="data.title" :used-keys="otherKeys" />
    <FormField v-if="kind === 'sheet_widgets' && data.kind === 'note'" label="Дополнить панель" vertical title="Выберите уже созданную панель; её ключ свяжет дополнение с основным показателем.">
      <RuleReferencePicker kind="widget" :value="data.key" label="Дополнить панель" @pick="entry => data.key = entry.key" />
    </FormField>
    <AbilityRuleFields :fields="mainFields" :data="data" @update:data="update" />
    <template v-for="gate in gates" :key="gate.title">
      <FormField :label="gate.title" :title="`Включите, чтобы настроить: ${gate.keys.map(key => fields.find(field => field.key === key)?.name).join(', ')}.`">
        <ToggleSwitch :model-value="enabled[gate.title]" :aria-label="gate.title" @update:model-value="value => setGate(gate, value)" />
      </FormField>
      <AbilityRuleFields v-if="enabled[gate.title]" :fields="fieldsFor(gate.keys)" :data="data" @update:data="update" />
    </template>
    <AbilityUnlockField v-if="kind === 'sheet_widgets'" :data="data" />
  </div>
</template>
<script setup>
import { computed, inject, onScopeDispose, reactive, watchEffect } from 'vue'
import { FormField, ToggleSwitch } from '@sylvieshare/share-ui'
import { itemFieldEditorKey } from '@/features/character-editor/components/useItemFieldEditor'
import { abilityMechanicManifest, mechanicFields, updateMechanic } from './abilityMechanicManifest'
import { hasFieldValue } from './abilityEditorProfile'
import AbilityRuleFields from './AbilityRuleFields.vue'
import RuleKeyField from './RuleKeyField.vue'
import RuleReferencePicker from './RuleReferencePicker.vue'
import AbilityUnlockField from './AbilityUnlockField.vue'
const props = defineProps({ kind: String, data: Object, fields: Array })
const editor = inject(itemFieldEditorKey, {})
const manifest = computed(() => abilityMechanicManifest[props.kind])
const enabled = reactive(Object.fromEntries(manifest.value.gates.map(gate => [gate.title, gate.keys.some(key => hasFieldValue(props.data[key]))])))
const gates = computed(() => manifest.value.gates.filter(gate => !gate.when || gate.when(props.data)))
const fieldsFor = keys => mechanicFields(props.kind, props.fields, keys, props.data)
const mainFields = computed(() => fieldsFor(manifest.value.main.filter(key => key !== 'title')))
const otherKeys = computed(() => (editor.itemData?.[props.kind] || []).filter(row => row !== props.data).map(row => row.key))
const validationKey = Symbol('mechanic')
watchEffect(() => {
  let error = ''
  if (props.kind === 'sheet_widgets') {
    if (props.data.kind === 'toggle' && !props.data.status_effect_key) error = 'Панель на листе: выберите связанный эффект для переключателя.'
    if (props.data.value_source === 'weapon_damage' && !editor.itemData?.weapon_damage?.length) error = 'Панель на листе: добавьте правило дополнительного урона.'
    if (props.data.value_source === 'scaling' && !editor.itemData?.scaling?.length) error = 'Панель на листе: добавьте таблицу развития с уровнем.'
    if (props.data.kind === 'note' && !props.data.key) error = 'Панель на листе: выберите панель для дополнения.'
  }
  editor.setValidationError?.(validationKey, error)
})
onScopeDispose(() => editor.setValidationError?.(validationKey, ''))
function update(value) { updateMechanic(props.kind, props.data, value) }
function setGate(gate, value) { enabled[gate.title] = value; if (!value) for (const key of gate.keys) delete props.data[key] }
</script>
