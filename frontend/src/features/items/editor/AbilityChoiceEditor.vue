<template>
  <div class="ability-action-fields">
    <AbilityRuleFields :fields="fieldsFor(['text'])" :data="data" @update:data="update" />
    <RuleKeyField v-model="data.key" :title="data.text" :used-keys="otherKeys" />
    <AbilityRuleFields :fields="fieldsFor(['count'])" :data="data" @update:data="update" />
    <FormField label="Откуда выбирать" vertical title="Свой список, словарь правил или объекты справочника.">
      <FormSelect :value="data.source || 'inline'" aria-label="Откуда выбирать" @update:value="changeSource">
        <option value="inline">Свой список вариантов</option><option value="suggest">Один словарь</option><option value="suggest_union">Несколько словарей вместе</option><option value="item">Объекты справочника</option>
      </FormSelect>
    </FormField>
    <p v-if="loadError" role="alert">{{ loadError }} <AddButton label="Повторить" @click="load" /></p>
    <FormField v-if="data.source === 'suggest'" label="Словарь" vertical title="Например, навыки или инструменты.">
      <FormSelect :value="data.from_suggest_id || ''" aria-label="Словарь" @update:value="v => data.from_suggest_id = Number(v)"><option value="">Выберите словарь</option><option v-for="type in suggestTypes" :key="type.id" :value="type.id">{{ type.name }}</option></FormSelect>
    </FormField>
    <AbilityRuleFields v-if="data.source === 'suggest_union'" :fields="[unionField]" :data="{ dictionaries: (data.suggest_sources || []).map(s => s.suggest_id) }" @update:data="value => setSources(value.dictionaries)" />
    <FormField v-if="data.source === 'item'" label="Коллекция справочника" vertical title="Из какой коллекции игрок выбирает объекты.">
      <FormSelect :value="data.from_item_type_id || ''" aria-label="Коллекция справочника" @update:value="changeItemType"><option value="">Выберите коллекцию</option><option v-for="type in itemTypes.allTypes" :key="type.id" :value="type.id">{{ type.name }}</option></FormSelect>
    </FormField>
    <AbilityChoiceFilter v-if="data.source === 'item' && data.from_item_type_id" :data="data" />
    <AbilityChoiceOptions v-if="!data.source || data.source === 'inline'" v-model="data.options" :fields="fields.find(f => f.key === 'options')?.fields" />
    <AbilityRuleFields :fields="fieldsFor(['unique_across_takes'])" :data="data" @update:data="update" />
    <AbilityRuleFields v-if="['suggest', 'suggest_union'].includes(data.source)" :fields="eligibilityFields" :data="data" @update:data="update" />
    <template v-if="data.source === 'item' && Number(data.from_item_type_id) === 5">
      <AbilityRuleFields :fields="fieldsFor(['grant_spells'])" :data="data" @update:data="update" />
      <AbilityRuleFields v-if="data.grant_spells" :fields="fieldsFor(['casting_ability', 'slotless'])" :data="data" @update:data="update" />
    </template>
    <AbilityChoiceExtras :data="data" :fields="fields" />
    <AbilityUnlockField v-if="fields.some(f => f.key === 'level')" :data="data" />
  </div>
</template>
<script setup>
import { computed, inject, onMounted, onScopeDispose, ref, watchEffect } from 'vue'
import { AddButton, FormField, FormSelect } from '@sylvieshare/share-ui'
import { suggestApi } from '@/shared/api/suggestApi'
import { useItemTypesStore } from '@/stores/itemTypes'
import { itemFieldEditorKey } from '@/features/character-editor/components/useItemFieldEditor'
import RuleKeyField from './RuleKeyField.vue'
import AbilityRuleFields from './AbilityRuleFields.vue'
import AbilityUnlockField from './AbilityUnlockField.vue'
import AbilityChoiceOptions from './AbilityChoiceOptions.vue'
import AbilityChoiceFilter from './AbilityChoiceFilter.vue'
import AbilityChoiceExtras from './AbilityChoiceExtras.vue'
const props = defineProps({ data: Object, fields: Array })
const editor = inject(itemFieldEditorKey, {})
const itemTypes = useItemTypesStore()
const suggestTypes = ref([]), loadError = ref('')
const otherKeys = computed(() => (editor.itemData?.choices || []).filter(c => c !== props.data).map(c => c.key))
const fieldsFor = keys => keys.map(k => props.fields.find(f => f.key === k)).filter(Boolean)
const unionField = computed(() => ({ key: 'dictionaries', type: 'option_array', name: 'Словари', options: suggestTypes.value.map(s => ({ value: s.id, label: s.name })), hint: 'Игрок выбирает из общего списка этих словарей.' }))
const eligibilityFields = [
  { key: 'requires_proficiency', type: 'bool', name: 'Только уже освоенные владения' },
  { key: 'exclude_rank', type: 'select', name: 'Исключить варианты', emptyLabel: 'Ничего не исключать', options: [{ value: 1, label: 'С уже полученным владением' }, { value: 2, label: 'С уже полученной компетентностью' }] },
]
async function load() {
  loadError.value = ''
  try { const result = await suggestApi.types(); suggestTypes.value = result.items || []; await itemTypes.ensureAll() }
  catch { loadError.value = 'Не удалось загрузить источники выбора.' }
}
onMounted(load)
function update(value) {
  if (!value.grant_spells && props.data.grant_spells) for (const key of ['casting_ability', 'slotless', 'cast_level', 'counts_as_known', 'casting_ability_choice_key']) delete value[key]
  if (value.exclude_rank != null) value.exclude_rank = Number(value.exclude_rank) || null
  for (const key of Object.keys(props.data)) if (!(key in value)) delete props.data[key]
  Object.assign(props.data, value)
}
function changeSource(source) {
  if (source === props.data.source) return
  for (const key of ['from_suggest_id', 'from_item_type_id', 'suggest_sources', 'options', 'item_filter', 'item_filter_from_choice', 'grant_spells', 'casting_ability', 'casting_ability_choice_key', 'cast_level', 'slotless', 'ability_bonus', 'grant_proficiency', 'requires_proficiency', 'exclude_rank']) delete props.data[key]
  props.data.source = source
}
function changeItemType(value) {
  props.data.from_item_type_id = Number(value)
  for (const key of ['item_filter', 'grant_spells', 'casting_ability', 'slotless']) delete props.data[key]
}
function setSources(ids) {
  props.data.suggest_sources = ids.map(id => props.data.suggest_sources?.find(s => s.suggest_id === id) || { suggest_id: id, label: suggestTypes.value.find(s => s.id === id)?.name || '', prefix: ({ 15: 'skill', 5: 'tool', 3: 'armor', 4: 'weapon', 6: 'language' })[id] || `dictionary_${id}` })
}
const validationKey = Symbol('choice')
watchEffect(() => {
  const d = props.data
  const invalid = !d.key || otherKeys.value.includes(d.key) || !(Number(d.count) > 0)
    || (d.source === 'suggest' && !d.from_suggest_id) || (d.source === 'item' && !d.from_item_type_id)
    || (d.source === 'suggest_union' && !d.suggest_sources?.length)
    || ((!d.source || d.source === 'inline') && (!d.options?.length || d.options.some(o => !o.label?.trim() || !o.value) || new Set(d.options.map(o => o.value)).size !== d.options.length))
  editor.setValidationError?.(validationKey, invalid ? 'Выбор: заполните уникальный ключ, количество и доступные варианты.' : '')
})
onScopeDispose(() => editor.setValidationError?.(validationKey, ''))
</script>
