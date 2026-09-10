<template>
  <div class="ability-rule-field" :class="{ 'ability-rule-field--wide': wide }">
    <component :is="hideLabel ? 'div' : FormField"
      v-bind="hideLabel ? { role: 'group', 'aria-label': field.name, title: hint } : { label: field.name + (field.required ? ' *' : ''), vertical: true, title: hint }"
    >
      <div v-if="['option_array', 'suggest_array'].includes(field.type)" class="ability-rule-rows">
        <BaseTile v-for="value in modelValue || []" :key="value" class="ability-selection-row">
          <span>{{ options.find(option => String(option.value) === String(value))?.label || value }}</span>
          <RemoveButton icon="trash" :label="`Убрать ${options.find(option => String(option.value) === String(value))?.label || value}`" @click="set(modelValue.filter(v => String(v) !== String(value)))" />
        </BaseTile>
        <FormSelect value="" :aria-label="`Добавить: ${field.name}`" @update:value="value => { const option = options.find(o => String(o.value) === String(value)); if (option) set([...(modelValue || []), option.value]) }">
          <option value="">Добавить…</option>
          <option v-for="option in options.filter(o => !(modelValue || []).some(v => String(v) === String(o.value)))" :key="option.value" :value="option.value">{{ option.label }}</option>
        </FormSelect>
      </div>
      <div v-else-if="field.type === 'enum_array'" class="ability-multi">
        <FormField v-for="option in options" :key="option.value" :label="option.label">
          <ToggleSwitch :model-value="(modelValue || []).some(v => String(v) === String(option.value))" :aria-label="option.label" @update:model-value="checked => set(checked ? [...(modelValue || []), option.value] : (modelValue || []).filter(v => String(v) !== String(option.value)))" />
        </FormField>
      </div>
      <RuleReferenceList v-else-if="field.key === 'required_status_codes'" :model-value="modelValue || []" kind="status" :label="field.name" @update:model-value="set" />
      <div v-else-if="referenceKind" class="ability-reference">
        <RuleReferencePicker :kind="referenceKind" :value="modelValue" :label="field.name" :only-current="referenceKind !== 'resource_pool' && referenceKind !== 'status'" :scope-item-id="field.key === 'choice_key' ? contextData.source_item_id || 0 : 0" @pick="entry => set(entry.key)" />
        <RemoveButton v-if="modelValue" icon="trash" :label="`Убрать: ${field.name}`" @click="set('')" />
      </div>
      <InputDescription v-else-if="field.type === 'description'" editable :block="{ id: field.key, content: { placeholder: field.placeholder || 'Описание и правила…' } }" :value="modelValue || ''" @update:value="(_, value) => set(value)" />
      <ToggleSwitch v-else-if="['bool', 'boolean'].includes(field.type)" :model-value="!!(modelValue ?? field.default)" :aria-label="field.name" @update:model-value="set" />
      <FormTextInput v-else-if="['int', 'float'].includes(field.type)" type="number" :step="field.type === 'float' ? 'any' : 1" :min="field.min" :max="field.max" :aria-label="field.name" :value="modelValue ?? ''" :placeholder="field.placeholder || 'Не задано'" @update:value="value => set(numberOrNull(value))" />
      <FormTextarea v-else-if="['textarea', 'text_array'].includes(field.type)" :aria-label="field.name" :value="field.type === 'text_array' ? (modelValue || []).join(', ') : modelValue || ''" @update:value="setText" />
      <ColorPresetPicker v-else-if="field.type === 'color'" inline allow-custom :model-value="modelValue || ''" @update:model-value="set" />
      <div v-else-if="field.type === 'item'" class="ability-reference">
        <button type="button" class="ability-link" :aria-label="field.name" :aria-required="field.required || undefined" @click="editor.openItemPicker(field.item_type, id => { set(id); editor.ensureItemNames([id]) })">{{ editor.itemRefLabel(modelValue?.id ?? modelValue) }}</button>
        <RemoveButton v-if="modelValue != null" icon="trash" :label="`Очистить: ${field.name}`" @click="set(null)" />
      </div>
      <FormSelect v-else-if="['select', 'suggest', 'dice'].includes(field.type)" :aria-label="field.name" :value="modelValue ?? field.default ?? ''" @update:value="setSelect">
        <option value="">{{ field.emptyLabel || 'Не выбрано' }}</option>
        <option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option>
      </FormSelect>
      <ItemMultiSelect
        v-else-if="itemReference"
        :model-value="(modelValue || []).map(row => row.id)"
        :item-type-id="itemReference.item_type"
        :label="field.name"
        :z-index="editor.zIndex + 200"
        @update:model-value="ids => set(itemSelectionRows(modelValue, ids))"
      />
      <AbilityRuleFields v-else-if="field.type === 'object'" :fields="field.fields" :data="modelValue || {}" advanced @update:data="set" />
      <div v-else-if="field.type === 'object_array'" class="ability-rule-rows">
        <BaseTile v-for="(row, index) in modelValue || []" :key="rowKeys[index] || index" class="ability-rule-row">
          <RemoveButton icon="trash" class="ability-dependency-remove" :label="`Удалить ${rowTitle(row, index)}`" @click="pendingRow = index" />
          <details :open="index === expandedRow || undefined">
            <summary>{{ rowTitle(row, index) }}</summary>
            <AbilityRuleFields :fields="field.fields" :data="row" advanced @update:data="value => updateRow(index, value)" />
          </details>
        </BaseTile>
        <button type="button" class="ability-link" @click="addRow">+ Добавить запись</button>
      </div>
      <FormTextInput v-else :aria-label="field.name" :placeholder="field.placeholder" :value="modelValue ?? ''" @update:value="set" />
    </component>
    <ConfirmDialog v-if="pendingRow != null" title="Удалить запись?" :message="`Запись «${rowTitle(modelValue[pendingRow], pendingRow)}» будет удалена после сохранения способности.`" :z-index="(editor.zIndex || 4500) + 300" @confirm="removeRow(pendingRow)" @cancel="pendingRow = null" @close="pendingRow = null" />
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import { ConfirmDialog, RemoveButton, BaseTile, ColorPresetPicker, FormField, FormTextInput, FormSelect, FormTextarea, ToggleSwitch } from '@sylvieshare/share-ui'
import RuleReferencePicker from './RuleReferencePicker.vue'
import RuleReferenceList from './RuleReferenceList.vue'
import ItemMultiSelect from '@/features/handbook/components/ItemMultiSelect.vue'
import { itemSelectionField, itemSelectionRows } from '@/features/handbook/objects/lib/itemSelection'
import InputDescription from '@/shared/ui/InputDescription.vue'
import AbilityRuleFields from './AbilityRuleFields.vue'
import { itemFieldEditorKey } from '@/features/character-editor/components/useItemFieldEditor'
import { defaultDataForFields, numberOrNull } from '@/features/handbook/objects/lib/schemaFields'
import { SYSTEM_DICE } from '@/shared/lib/systemDice'
import { abilityFieldHint } from './abilityEditorProfile'

const props = defineProps({ field: { type: Object, required: true }, modelValue: { default: undefined }, hideLabel: Boolean, contextData: { type: Object, default: () => ({}) } })
const emit = defineEmits(['update:modelValue'])
const editor = inject(itemFieldEditorKey)
const pendingRow = ref(null)
const referenceKind = computed(() => props.field.type === 'text' && ({ weapon_damage_key: 'weapon_damage', resource_key: 'resource', resource_pool_key: 'resource_pool', status_effect_code: 'status', choice_key: 'choice', unique_choice_key: 'choice', depends_on_choice: 'choice', casting_ability_choice_key: 'choice', status_effect_key: 'effect_link' })[props.field.key])
const itemReference = computed(() => itemSelectionField(props.field))
const hint = computed(() => abilityFieldHint(props.field))
const wide = computed(() => ['description', 'object', 'object_array', 'text_array', 'suggest_array', 'enum_array', 'option_array', 'textarea'].includes(props.field.type))
const options = computed(() => {
  if (props.field.type === 'dice') return SYSTEM_DICE.map(die => ({ value: die.id, label: die.value }))
  if (['suggest', 'suggest_array'].includes(props.field.type)) return editor.getSuggests(editor.getSuggestId(props.field)).map(row => ({ value: row.id, label: row.value }))
  return props.field.options || []
})
const expandedRow = ref((props.modelValue || []).length === 1 ? 0 : -1)
const rowKeys = ref([])
const set = value => emit('update:modelValue', value)
function setSelect(value) { set(props.field.type === 'suggest' || props.field.numeric ? numberOrNull(value) : value || null) }
function setText(value) { set(props.field.type === 'text_array' ? value.split(',').map(entry => entry.trim()).filter(Boolean) : value) }
function updateRow(index, value) { set(props.modelValue.map((row, rowIndex) => rowIndex === index ? value : row)) }
function addRow() {
  expandedRow.value = (props.modelValue || []).length
  rowKeys.value = (props.modelValue || []).map((_, index) => rowKeys.value[index] || crypto.randomUUID())
  rowKeys.value.push(crypto.randomUUID())
  set([...(props.modelValue || []), defaultDataForFields(props.field.fields)])
}
function removeRow(index) {
  pendingRow.value = null
  rowKeys.value.splice(index, 1)
  set(props.modelValue.filter((_, rowIndex) => rowIndex !== index))
  expandedRow.value = -1
}
function rowTitle(row, index) {
  const itemField = props.field.fields?.find(field => field.type === 'item')
  return row.title || row.label || row.text || (itemField && row[itemField.key] != null ? editor.itemRefLabel(row[itemField.key]) : '') || `${props.field.name} · ${index + 1}`
}
</script>
