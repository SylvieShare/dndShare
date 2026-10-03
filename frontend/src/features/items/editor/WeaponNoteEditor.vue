<template>
  <CatalogueFields :fields="fields.filter(field => field.key !== 'resource_key')" :data="data" :root-data="editor.itemData" path="weapon_notes" :type-id="editor.typeId || 19" @update:data="update" />
  <FormField label="Заряды в этом блоке" title="Счётчик ресурса будет показан в заголовке свойства, без отдельного блока зарядов.">
    <ToggleSwitch :model-value="linked" :disabled="!options.length" aria-label="Заряды в этом блоке" @update:model-value="toggle" />
  </FormField>
  <FormField v-if="linked" label="Ресурс свойства" vertical>
    <FormSelect :value="data.resource_key" aria-label="Ресурс свойства" @update:value="value => data.resource_key = value"><option v-for="option in options" :key="option.key" :value="option.key">{{ option.title }}</option></FormSelect>
  </FormField>
</template>
<script setup>
import { computed, inject, onScopeDispose, watchEffect } from 'vue'
import { FormField, FormSelect, ToggleSwitch } from '@sylvieshare/share-ui'
import CatalogueFields from './catalogue/CatalogueFields.vue'
import { itemFieldEditorKey } from '@/features/character-editor/components/useItemFieldEditor'
import { itemResourceOptions } from './itemResourceOptions'
const props = defineProps({ data: Object, fields: { type: Array, default: () => [] } })
const editor = inject(itemFieldEditorKey, {})
const options = computed(() => itemResourceOptions(editor.itemData || {}))
const linked = computed(() => Object.hasOwn(props.data, 'resource_key'))
const validation = Symbol('weapon-note-resource')
watchEffect(() => editor.setValidationError?.(validation, linked.value && !options.value.some(option => option.key === props.data.resource_key) ? 'Свойство: выберите существующий ресурс предмета.' : ''))
onScopeDispose(() => editor.setValidationError?.(validation, ''))
function toggle(on) { if (on && options.value.length) props.data.resource_key = options.value[0].key; else delete props.data.resource_key }
function update(value) { Object.assign(props.data, value) }
</script>
