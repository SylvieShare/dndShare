<template>
  <div class="ability-rule-field" :class="{ 'ability-rule-field--wide': wide }">
    <FormField :label="field.name + (field.required ? ' *' : '')" vertical :title="hint">
      <InputDescription v-if="field.type === 'description'" editable :block="{ id: field.key, content: { placeholder: 'Как работает способность…' } }" :value="modelValue || ''" @update:value="(_, value) => set(value)" />
      <ToggleSwitch v-else-if="['bool', 'boolean'].includes(field.type)" :model-value="!!modelValue" :aria-label="field.name" @update:model-value="set" />
      <FormTextInput v-else-if="['int', 'float'].includes(field.type)" type="number" :step="field.type === 'float' ? 'any' : 1" :aria-label="field.name" :value="modelValue ?? ''" placeholder="Не задано" @update:value="value => set(numberOrNull(value))" />
      <FormTextarea v-else-if="['textarea', 'text_array'].includes(field.type)" :aria-label="field.name" :value="field.type === 'text_array' ? (modelValue || []).join(', ') : modelValue || ''" @update:value="setText" />
      <ColorPresetPicker v-else-if="field.type === 'color'" inline allow-custom :model-value="modelValue || ''" @update:model-value="set" />
      <div v-else-if="field.type === 'item'" class="ability-reference">
        <button type="button" class="ability-link" :aria-label="field.name" :aria-required="field.required || undefined" @click="editor.openItemPicker(field.item_type, id => { set(id); editor.ensureItemNames([id]) })">{{ editor.itemRefLabel(modelValue) }}</button>
        <button v-if="modelValue != null" type="button" class="ability-link" :aria-label="`Очистить: ${field.name}`" @click="set(null)">×</button>
      </div>
      <FormSelect v-else-if="['select', 'suggest', 'dice'].includes(field.type)" :aria-label="field.name" :value="modelValue ?? ''" @update:value="setSelect">
        <option value="">Не выбрано</option>
        <option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option>
      </FormSelect>
      <div v-else-if="field.type === 'suggest_array'" class="ability-multi">
        <button v-for="id in modelValue || []" :key="id" type="button" class="ability-link" :aria-label="`Убрать ${editor.getSuggestLabel(editor.getSuggestId(field), id)}`" @click="set(modelValue.filter(value => value !== id))">{{ editor.getSuggestLabel(editor.getSuggestId(field), id) }} ×</button>
        <FormSelect :aria-label="`Добавить: ${field.name}`" value="" @update:value="value => value !== '' && set([...(modelValue || []), Number(value)])">
          <option value="">Добавить…</option>
          <option v-for="option in options.filter(option => !(modelValue || []).includes(option.value))" :key="option.value" :value="option.value">{{ option.label }}</option>
        </FormSelect>
      </div>
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
          <details :open="index === expandedRow || undefined">
            <summary>{{ rowTitle(row, index) }}</summary>
            <AbilityRuleFields :fields="field.fields" :data="row" advanced @update:data="value => updateRow(index, value)" />
            <button type="button" class="ability-link ability-link--danger" @click="removeRow(index)">Удалить запись</button>
          </details>
        </BaseTile>
        <button type="button" class="ability-link" @click="addRow">+ Добавить запись</button>
      </div>
      <FormTextInput v-else :aria-label="field.name" :value="modelValue ?? ''" @update:value="set" />
    </FormField>
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import { BaseTile, ColorPresetPicker, FormField, FormTextInput, FormSelect, FormTextarea, ToggleSwitch } from '@sylvieshare/share-ui'
import ItemMultiSelect from '@/features/handbook/components/ItemMultiSelect.vue'
import { itemSelectionField, itemSelectionRows } from '@/features/handbook/objects/lib/itemSelection'
import InputDescription from '@/shared/ui/InputDescription.vue'
import AbilityRuleFields from './AbilityRuleFields.vue'
import { itemFieldEditorKey } from '@/features/character-editor/components/useItemFieldEditor'
import { defaultDataForFields, numberOrNull } from '@/features/handbook/objects/lib/schemaFields'
import { SYSTEM_DICE } from '@/shared/lib/systemDice'
import { abilityFieldHint } from './abilityEditorProfile'

const props = defineProps({ field: { type: Object, required: true }, modelValue: { default: undefined } })
const emit = defineEmits(['update:modelValue'])
const editor = inject(itemFieldEditorKey)
const itemReference = computed(() => itemSelectionField(props.field))
const hint = computed(() => abilityFieldHint(props.field))
const wide = computed(() => ['description', 'object', 'object_array', 'text_array', 'suggest_array', 'textarea'].includes(props.field.type))
const options = computed(() => {
  if (props.field.type === 'dice') return SYSTEM_DICE.map(die => ({ value: die.id, label: die.value }))
  if (['suggest', 'suggest_array'].includes(props.field.type)) return editor.getSuggests(editor.getSuggestId(props.field)).map(row => ({ value: row.id, label: row.value }))
  return props.field.options || []
})
const expandedRow = ref((props.modelValue || []).length === 1 ? 0 : -1)
const rowKeys = ref([])
const set = value => emit('update:modelValue', value)
function setSelect(value) { set(props.field.type === 'suggest' ? numberOrNull(value) : value || null) }
function setText(value) { set(props.field.type === 'text_array' ? value.split(',').map(entry => entry.trim()).filter(Boolean) : value) }
function updateRow(index, value) { set(props.modelValue.map((row, rowIndex) => rowIndex === index ? value : row)) }
function addRow() {
  expandedRow.value = (props.modelValue || []).length
  rowKeys.value = (props.modelValue || []).map((_, index) => rowKeys.value[index] || crypto.randomUUID())
  rowKeys.value.push(crypto.randomUUID())
  set([...(props.modelValue || []), defaultDataForFields(props.field.fields)])
}
function removeRow(index) {
  rowKeys.value.splice(index, 1)
  set(props.modelValue.filter((_, rowIndex) => rowIndex !== index))
  expandedRow.value = -1
}
function rowTitle(row, index) {
  const itemField = props.field.fields?.find(field => field.type === 'item')
  return row.title || row.label || row.text || (itemField && row[itemField.key] != null ? editor.itemRefLabel(row[itemField.key]) : '') || `${props.field.name} · ${index + 1}`
}
</script>
