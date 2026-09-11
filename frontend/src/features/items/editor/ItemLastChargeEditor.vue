<template>
  <div class="ability-action-fields">
    <FormField v-if="resources.length > 1 || missingResource" label="Какой ресурс заканчивается" title="Проверка появляется при расходе последней ячейки выбранного ресурса." vertical>
      <FormSelect :value="data.resource_key || ''" aria-label="Ресурс последнего заряда" @update:value="value => data.resource_key = value || undefined">
        <option v-for="resource in resources" :key="resource.key" :value="resource.key">{{ resource.title }}</option>
        <option v-if="missingResource" :value="data.resource_key || ''">Ресурс недоступен — добавьте его в зависимостях</option>
      </FormSelect>
    </FormField>
    <FormField label="Кость проверки" title="Одна кость без модификаторов, преимущества и влияния характеристик." vertical>
      <FormSelect v-model:value="data.dice" aria-label="Кость проверки"><option v-for="n in [4, 6, 8, 10, 12, 20, 100]" :key="n" :value="`d${n}`">к{{ n }}</option></FormSelect>
    </FormField>
    <FormField label="Опасный результат: от 1 до" title="При результате в этом диапазоне применяется последствие. Для Посоха ударов — только 1." vertical>
      <FormTextInput :value="data.failure_max" type="number" :min="1" :max="Number(data.dice?.slice(1)) || 20" aria-label="Верхняя граница опасного результата" @update:value="data.failure_max = $event === '' ? undefined : Number($event)" />
    </FormField>
    <FormField label="Последствие" title="Отключает магические свойства, заряды и восстановление только у этого экземпляра. Основа остаётся." vertical>
      <FormSelect v-model:value="data.consequence" aria-label="Последствие последнего заряда"><option value="lose_magic">Теряет магические свойства</option></FormSelect>
    </FormField>
  </div>
</template>
<script setup>
import { computed, inject, onScopeDispose, watch, watchEffect } from 'vue'
import { FormField, FormSelect, FormTextInput } from '@sylvieshare/share-ui'
import { itemFieldEditorKey } from '@/features/character-editor/components/useItemFieldEditor'
import { lastChargeRuleError } from '@/features/character-editor/lib/itemLastCharge'
const props = defineProps({ data: { type: Object, required: true } })
const editor = inject(itemFieldEditorKey, {})
const validationKey = Symbol('last-charge')
const resources = computed(() => {
  const item = editor.itemData || {}
  if (item.use_resources?.length) return item.use_resources.filter(row => row.key).map(row => ({ key: row.key, title: row.title || row.key }))
  return (item.max_use != null || item.manual_size || item.max_use_stat != null || item.max_use_scaling || item.max_use_level_multiplier != null) ? [{ key: '', title: 'Заряды предмета' }] : []
})
const missingResource = computed(() => !resources.value.some(row => row.key === (props.data.resource_key || '')))
watch(resources, rows => { if (rows.length === 1 && !props.data.resource_key) props.data.resource_key = rows[0].key || undefined }, { immediate: true })
watchEffect(() => editor.setValidationError?.(validationKey, lastChargeRuleError(props.data) || (missingResource.value ? 'При последнем заряде: сначала добавьте и выберите ресурс предмета.' : '')))
onScopeDispose(() => editor.setValidationError?.(validationKey, ''))
</script>
