<template>
  <div class="ability-action-fields">
    <BaseTile v-for="(option, index) in modelValue" :key="rowKey(option)" class="ability-rule-row">
      <div class="ability-row-heading"><strong>Вариант {{ index + 1 }}</strong><RemoveButton icon="trash" label="Удалить вариант" @click="removing = index" /></div>
      <FormField label="Название варианта" vertical title="Этот текст увидит игрок."><FormTextInput v-model:value="option.label" aria-label="Название варианта" /></FormField>
      <RuleKeyField v-model="option.value" :title="option.label" :used-keys="modelValue.filter(o => o !== option).map(o => o.value)" />
      <FormField label="Описание варианта" vertical title="Необязательное пояснение игроку."><FormTextarea v-model:value="option.desc" aria-label="Описание варианта" /></FormField>
    </BaseTile>
    <AddButton label="Добавить вариант" @click="$emit('update:modelValue', [...modelValue, {}])" />
    <ConfirmDialog v-if="removing != null" title="Удалить вариант?" message="Ссылки на этот вариант в зависимостях потребуется обновить." :z-index="(editor.zIndex || 4500) + 300" @confirm="remove" @close="removing = null" @cancel="removing = null" />
  </div>
</template>
<script setup>
import { inject, ref } from 'vue'
import { AddButton, BaseTile, ConfirmDialog, FormField, FormTextInput, FormTextarea, RemoveButton } from '@sylvieshare/share-ui'
import { itemFieldEditorKey } from '@/features/character-editor/components/useItemFieldEditor'
import RuleKeyField from './RuleKeyField.vue'
const props = defineProps({ modelValue: { type: Array, default: () => [] } })
const emit = defineEmits(['update:modelValue'])
const editor = inject(itemFieldEditorKey, {})
const removing = ref(null)
const rowKeys = new WeakMap()
function rowKey(row) { if (!rowKeys.has(row)) rowKeys.set(row, crypto.randomUUID()); return rowKeys.get(row) }
function remove() { emit('update:modelValue', props.modelValue.filter((_, i) => i !== removing.value)); removing.value = null }
</script>
