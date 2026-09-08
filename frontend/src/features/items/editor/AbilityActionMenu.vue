<template>
  <div class="ability-rule-rows">
    <BaseTile v-for="(row, index) in modelValue" :key="ids[index]" class="ability-rule-row">
      <RemoveButton icon="trash" class="ability-dependency-remove" :label="`Удалить пункт «${row.title || index + 1}»`" @click="pending = index" />
      <details open>
        <summary>{{ row.title || `Пункт меню · ${index + 1}` }}</summary>
        <div class="ability-action-fields">
          <FormField label="Название пункта" vertical title="Текст, который игрок увидит в меню действия."><FormTextInput v-model:value="row.title" aria-label="Название пункта" /></FormField>
          <RuleKeyField v-model="row.key" :title="row.title" :used-keys="modelValue.filter((_, i) => i !== index).map(entry => entry.key)" />
          <FormField label="Изменяемый показатель" vertical title="Выберите существующий показатель листа, например уровень истощения.">
            <RuleReferencePicker kind="counter" :value="row.counter_key" :value-id="row.value_id" label="Показатель персонажа" @pick="entry => Object.assign(row, { kind: 'adjust_counter', counter_key: entry.key, value_id: entry.valueId })" />
          </FormField>
          <AbilityRuleFields :fields="menuFields" :data="row" @update:data="value => Object.assign(row, value)" />
          <details class="ability-advanced">
            <summary>Особый показатель</summary>
            <AbilityRuleFields :fields="customFields" :data="row" @update:data="value => Object.assign(row, value)" />
          </details>
        </div>
      </details>
    </BaseTile>
    <AddButton label="Добавить пункт меню" @click="add" />
    <ConfirmDialog v-if="pending != null" title="Удалить пункт меню?" :message="`Пункт «${modelValue[pending]?.title || pending + 1}» будет удалён после сохранения способности.`" :z-index="(editor.zIndex || 4500) + 300" @confirm="remove" @cancel="pending = null" @close="pending = null" />
  </div>
</template>
<script setup>
import { inject, ref } from 'vue'
import { AddButton, BaseTile, ConfirmDialog, FormField, FormTextInput, RemoveButton } from '@sylvieshare/share-ui'
import { itemFieldEditorKey } from '@/features/character-editor/components/useItemFieldEditor'
import AbilityRuleFields from './AbilityRuleFields.vue'
import RuleKeyField from './RuleKeyField.vue'
import RuleReferencePicker from './RuleReferencePicker.vue'
const props = defineProps({ modelValue: { type: Array, default: () => [] } })
const emit = defineEmits(['update:modelValue'])
const editor = inject(itemFieldEditorKey, {})
const ids = ref(props.modelValue.map(() => crypto.randomUUID()))
const pending = ref(null)
const menuFields = [
 { key: 'delta', name: 'Изменить на', type: 'int', hint: 'Положительное число увеличивает показатель, отрицательное уменьшает.' },
 { key: 'min', name: 'Нижняя граница', type: 'int', hint: 'Показатель не опустится ниже этой величины. По умолчанию 0.' },
 { key: 'max', name: 'Верхняя граница', type: 'int', hint: 'Пустое поле означает отсутствие верхней границы.' },
 { key: 'tone', name: 'Цвет пункта', type: 'select', options: [{value:'accent',label:'Обычный'},{value:'danger',label:'Опасность'},{value:'warning',label:'Предупреждение'},{value:'success',label:'Успех'},{value:'info',label:'Информация'}] },
]
const customFields = [
 { key: 'value_id', name: 'Поле листа', type: 'text', hint: 'Контейнер данных персонажа. Например exhaustion. Используйте только реально существующие поля.' },
 { key: 'counter_key', name: 'Ключ показателя', type: 'text', hint: 'Числовое поле внутри контейнера. Например level для exhaustion.' },
]
function add() { ids.value.push(crypto.randomUUID()); emit('update:modelValue', [...props.modelValue, { title: '', kind: 'adjust_counter', delta: 1, min: 0, tone: 'accent' }]) }
function remove() { ids.value.splice(pending.value, 1); emit('update:modelValue', props.modelValue.filter((_, index) => index !== pending.value)); pending.value = null }
</script>
