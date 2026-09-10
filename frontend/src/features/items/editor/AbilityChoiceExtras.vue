<template>
  <div v-if="available.length" class="ability-action-fields">
    <AbilityRuleFields :fields="available" :data="data" @update:data="v => Object.assign(data, v)" />
    <template v-if="hasDynamicFilter && data.source === 'item'">
      <FormField label="Фильтровать по другому выбору" title="Например, сначала выбрать класс, затем его заклинания."><ToggleSwitch :model-value="!!data.item_filter_from_choice" aria-label="Фильтровать по другому выбору" @update:model-value="v => data.item_filter_from_choice = v ? {} : undefined" /></FormField>
      <div v-if="data.item_filter_from_choice" class="ability-condition-fields">
        <AbilityRuleFields :fields="dynamicFields" :data="data.item_filter_from_choice" @update:data="v => data.item_filter_from_choice = v" />
      </div>
    </template>
  </div>
</template>
<script setup>
import { computed, inject } from 'vue'
import { FormField, ToggleSwitch } from '@sylvieshare/share-ui'
import { useItemTypesStore } from '@/stores/itemTypes'
import { itemFieldEditorKey } from '@/features/character-editor/components/useItemFieldEditor'
import { choiceFilterFields } from './choiceFilterFields'
import AbilityRuleFields from './AbilityRuleFields.vue'
const props = defineProps({ data: Object, fields: Array })
const editor = inject(itemFieldEditorKey, {}), types = useItemTypesStore()
const names = { depends_on_choice: 'Сначала завершить выбор', casting_ability_choice_key: 'Характеристика из другого выбора', ability_bonus: 'Прибавка выбранной характеристики', grant_proficiency: 'Даёт владение' }
const available = computed(() => props.fields.filter(f => {
  if (f.key === 'depends_on_choice') return true
  if (f.key === 'ability_bonus') return props.data.source === 'suggest' && Number(props.data.from_suggest_id) === 16
  if (f.key === 'grant_proficiency') return ['suggest', 'suggest_union'].includes(props.data.source)
  return ['casting_ability_choice_key', 'cast_level'].includes(f.key) && props.data.grant_spells
}).map(f => ({ ...f, name: names[f.key] || f.name })))
const hasDynamicFilter = computed(() => props.fields.some(f => f.key === 'item_filter_from_choice'))
const dynamicFields = computed(() => [
  { key: 'choice_key', name: 'Связанный выбор', type: 'select', options: (editor.itemData?.choices || []).filter(c => c !== props.data).map(c => ({ value: c.key, label: c.text || c.key })) },
  { key: 'path', name: 'Что должно совпасть с ответом', type: 'select', options: choiceFilterFields(types.getType(Number(props.data.from_item_type_id))?.fields).map(f => ({ value: f.path, label: f.name })) },
])
</script>
