<template>
  <div v-if="spec.optional" class="ability-rule-field ability-rule-field--wide catalogue-object">
    <FormField :label="spec.name" :title="spec.hint"><ToggleSwitch :model-value="enabled" :aria-label="spec.name" @update:model-value="toggle" /></FormField>
    <CatalogueField v-if="enabled" :field="{ ...spec, optional: false }" :data="data" :path="path" :type-id="typeId" :root-data="rootData" hide-label :resolved="true" @update:model-value="set" />
    <ConfirmDialog v-if="confirmOff" title="Убрать настройку?" :message="`Значение «${spec.name}» будет удалено после сохранения объекта.`" :z-index="zIndex" @confirm="disable" @close="confirmOff = false" @cancel="confirmOff = false" />
  </div>
  <div v-else-if="spec.createKey" class="catalogue-key"><RuleKeyField :model-value="value" :title="data.title || data.label || data.name || editor.itemName" :used-keys="usedKeys" @update:model-value="set" /></div>
  <div v-else-if="spec.type === 'int_by_suggest'" class="ability-rule-field ability-rule-field--wide">
    <FormField :label="spec.name" vertical :title="spec.hint"><div class="catalogue-cost">
      <FormTextInput type="number" step="any" min="0" :aria-label="`${spec.name}: сумма`" :value="value?.value ?? ''" placeholder="Сумма" @update:value="v => set({ ...value, value: numberOrNull(v) })" />
      <FormSelect :aria-label="`${spec.name}: валюта`" :value="value?.suggest_id ?? ''" @update:value="v => set({ ...value, suggest_id: numberOrNull(v) })"><option value="">Валюта</option><option v-for="s in editor.getSuggests(editor.getSuggestId(spec))" :key="s.id" :value="s.id">{{ s.value }}</option></FormSelect>
    </div></FormField>
  </div>
  <div v-else-if="spec.type === 'item_array'" class="ability-rule-field ability-rule-field--wide">
    <FormField :label="spec.name" vertical :title="spec.hint"><ItemMultiSelect :model-value="value || []" :item-type-id="spec.item_type" :include-child-types="spec.item_type === 2" :label="spec.name" :z-index="zIndex" @update:model-value="set" /></FormField>
  </div>
  <AbilityRuleField v-else-if="spec.type === 'level_set'" :field="levelField" :model-value="levels" @update:model-value="v => set(v.map(Number).sort((a,b) => a-b).join(','))" />
  <component v-else-if="spec.type === 'object'" :is="hideLabel ? 'div' : FormField" class="ability-rule-field ability-rule-field--wide catalogue-object" v-bind="hideLabel ? { role: 'group', 'aria-label': spec.name } : { label: spec.name, title: spec.hint, vertical: true }">
    <CatalogueFields :fields="spec.fields" :data="value || {}" :root-data="rootData" :path="path" :type-id="typeId" @update:data="set" />
    <p v-if="path === 'armor'" class="catalogue-rule-preview">{{ armorPreview }}</p>
  </component>
  <component v-else-if="isRows && !itemSelectionField(spec)" :is="hideLabel ? 'div' : FormField" class="ability-rule-field ability-rule-field--wide catalogue-rows" v-bind="hideLabel ? { role: 'group', 'aria-label': spec.name } : { label: spec.name, title: spec.hint, vertical: true }">
    <div class="catalogue-rows">
      <BaseTile v-for="(row, index) in rows" :key="rowKeys[index] || index" class="ability-rule-row">
        <RemoveButton icon="trash" class="ability-dependency-remove" :label="`Удалить: ${rowTitle(row, index)}`" @click="pending = index" />
        <details open>
          <summary>{{ rowTitle(row, index) }}</summary>
          <AbilityStatusEffectEditor v-if="path === 'status_effects'" :data="row" :fields="spec.fields" :allow-scaling="typeId !== 5" />
          <AbilityDependencyEditor v-else-if="['derived_effects', 'defenses'].includes(path)" :kind="path" :data="row" :fields="spec.fields" :allow-unlock="spec.fields.some(f => f.key === 'level')" />
          <CatalogueFields v-else :fields="rowFields" :data="row" :type-id="typeId" :root-data="rootData" :path="path" @update:data="v => updateRow(index, v)" />
        </details>
      </BaseTile>
      <AddButton :label="`Добавить: ${spec.rowName || spec.name}`" @click="addRow" />
    </div>
    <ConfirmDialog v-if="pending != null" title="Удалить запись?" :message="`Запись «${rowTitle(rows[pending], pending)}» будет удалена после сохранения объекта.`" :z-index="zIndex" @confirm="removeRow" @cancel="pending = null" @close="pending = null" />
  </component>
  <AbilityRuleField v-else :field="spec" :context-data="data" :model-value="value" :hide-label="hideLabel" @update:model-value="set" />
</template>
<script setup>
import { computed, inject, ref } from 'vue'
import { AddButton, BaseTile, ConfirmDialog, FormField, FormSelect, FormTextInput, RemoveButton, ToggleSwitch } from '@sylvieshare/share-ui'
import { itemFieldEditorKey } from '@/features/character-editor/components/useItemFieldEditor'
import { defaultDataForFields, numberOrNull } from '@/features/handbook/objects/lib/schemaFields'
import { itemSelectionField } from '@/features/handbook/objects/lib/itemSelection'
import ItemMultiSelect from '@/features/handbook/components/ItemMultiSelect.vue'
import AbilityRuleField from '../AbilityRuleField.vue'
import AbilityStatusEffectEditor from '../AbilityStatusEffectEditor.vue'
import AbilityDependencyEditor from '../AbilityDependencyEditor.vue'
import RuleKeyField from '../RuleKeyField.vue'
import { hasFieldValue } from '../abilityEditorProfile'
import { catalogueField } from './catalogueFields'
import CatalogueFields from './CatalogueFields.vue'
const props = defineProps({ field: Object, data: Object, path: String, typeId: Number, rootData: Object, hideLabel: Boolean, resolved: Boolean })
const emit = defineEmits(['update:modelValue'])
const editor = inject(itemFieldEditorKey)
const spec = computed(() => props.resolved ? props.field : catalogueField(props.field, props.typeId, props.path))
const value = computed(() => props.path === 'caster_progression' ? props.data.caster_progression ?? props.data.spellcasting?.progression : props.path === 'spellcasting.selection_mode' ? props.data.selection_mode || (props.data.prepares ? 'prepared' : 'known') : props.data[props.field.key])
const set = v => emit('update:modelValue', v)
const usedKeys = computed(() => {
  const siblings = props.rootData?.[props.path.split('.')[0]]
  return Array.isArray(siblings) ? siblings.filter(row => row !== props.data).map(row => row[props.field.key]).filter(Boolean) : []
})
const enabled = ref(hasFieldValue(value.value)), confirmOff = ref(false), pending = ref(null)
const zIndex = (editor.zIndex || 4500) + 300
const isRows = computed(() => ['object_array', 'blocks'].includes(spec.value.type))
const rows = computed(() => Array.isArray(value.value) ? value.value : [])
const rowKeys = ref(rows.value.map(() => crypto.randomUUID()))
const rowFields = computed(() => {
  if (spec.value.type === 'blocks') return [{ key: 'name', name: 'Название', type: 'text' }, { key: 'value', name: 'Описание и правила', type: 'description' }]
  const fields = spec.value.fields || []
  if (fields.some(f => catalogueField(f, props.typeId, `${props.path}.${f.key}`).createKey)) {
    const title = fields.find(f => ['title', 'label', 'name'].includes(f.key))
    return title ? [title, ...fields.filter(f => f !== title)] : fields
  }
  return fields
})
const levels = computed(() => String(value.value || '').split(',').map(Number).filter(n => n > 0))
const levelField = computed(() => ({ ...spec.value, type: 'enum_array', options: Array.from({ length: 20 }, (_, i) => ({ value: i + 1, label: String(i + 1) })) }))
const armorPreview = computed(() => value.value?.shield ? `КД + ${value.value.shield_bonus ?? '…'}` : `КД = ${value.value?.ac ?? '…'}${value.value?.use_dex ? ` + Ловкость${value.value.dex_cap != null ? ` (не более +${value.value.dex_cap})` : ''}` : ''}`)
function toggle(on) {
  if (!on && hasFieldValue(value.value)) { confirmOff.value = true; return }
  if (!on) { disable(); return }
  enabled.value = true
  set(spec.value.type === 'object' ? defaultDataForFields(spec.value.fields) : isRows.value ? [] : '')
}
function disable() { enabled.value = false; confirmOff.value = false; set(undefined) }
function rowTitle(row, index) {
  const itemField = rowFields.value.find(f => f.type === 'item' || f.key === 'item_id')
  return row.title || row.label || row.name || (itemField && row[itemField.key] ? editor.itemRefLabel(row[itemField.key]?.id ?? row[itemField.key]) : '') || `${spec.value.rowName || spec.value.name} · ${index + 1}`
}
function updateRow(index, row) { set(rows.value.map((r, i) => i === index ? row : r)) }
function addRow() { rowKeys.value.push(crypto.randomUUID()); set([...rows.value, defaultDataForFields(rowFields.value)]) }
function removeRow() { const index = pending.value; pending.value = null; rowKeys.value.splice(index, 1); set(rows.value.filter((_, i) => i !== index)) }
</script>
