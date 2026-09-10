<template>
  <div class="ability-action-fields">
    <FormField label="Выбор, от которого зависит защита" vertical title="Выберите решение игрока из другой способности, например драконье происхождение.">
      <RuleReferencePicker kind="choice" :value="data.choice_key" :owner-id="data.source_item_id" label="Выбор другой способности" @pick="pick" />
    </FormField>
    <p v-if="error" role="alert">{{ error }} <AddButton label="Повторить" @click="load" /></p>
    <LoadingState v-else-if="loading" label="Загрузка вариантов…" compact />
    <div v-for="(row, index) in data.options || []" :key="index" class="ability-condition-fields">
      <div class="ability-row-heading"><strong>{{ optionLabel(row.value) }}</strong><RemoveButton icon="trash" :label="`Удалить защиту ${optionLabel(row.value)}`" @click="pending = index" /></div>
      <AbilityRuleFields :fields="defenseFields" :data="row" @update:data="value => Object.assign(row, value)" />
    </div>
    <FormField v-if="available.length" label="Добавить защиту для варианта" vertical title="Один ответ игрока может давать несколько защит.">
      <FormSelect value="" aria-label="Добавить защиту для варианта" @update:value="add"><option value="">Выберите вариант</option><option v-for="option in available" :key="option.value" :value="option.value">{{ option.label }}</option></FormSelect>
    </FormField>
    <ConfirmDialog v-if="pending != null" title="Удалить защиту?" message="Связанный вариант выбора перестанет давать эту защиту." :z-index="(editor.zIndex || 4500) + 300" @confirm="remove" @close="pending = null" @cancel="pending = null" />
  </div>
</template>
<script setup>
import { LoadingState } from '@sylvieshare/share-ui'
import { computed, inject, onScopeDispose, ref, watch, watchEffect } from 'vue'
import { AddButton, ConfirmDialog, FormField, FormSelect, RemoveButton } from '@sylvieshare/share-ui'
import { parseItemChoiceFilter } from '@/features/items/lib/itemChoices'
import { itemsApi } from '@/shared/api/itemsApi'
import { useSuggestStore } from '@/stores/suggest'
import { itemFieldEditorKey } from '@/features/character-editor/components/useItemFieldEditor'
import AbilityRuleFields from './AbilityRuleFields.vue'
import RuleReferencePicker from './RuleReferencePicker.vue'
const props = defineProps({ data: Object, fields: Array })
const editor = inject(itemFieldEditorKey, {}), suggests = useSuggestStore()
const options = ref([]), error = ref(''), loading = ref(false), pending = ref(null)
let version = 0
const defenseFields = computed(() => props.fields.find(f => f.key === 'options')?.fields.filter(f => f.key !== 'value') || [])
const available = computed(() => options.value)
function optionLabel(value) { return options.value.find(o => String(o.value) === String(value))?.label || value }
function pick(entry) { props.data.source_item_id = entry.itemId; props.data.choice_key = entry.key; props.data.options = [] }
async function load() {
  const request = ++version
  options.value = []; error.value = ''
  if (!props.data.source_item_id || !props.data.choice_key) return
  loading.value = true
  try {
    const result = Number(props.data.source_item_id) === Number(editor.itemId) ? { items: [{ data: editor.itemData }] } : await itemsApi.byIds([props.data.source_item_id])
    const choice = result.items?.[0]?.data?.choices?.find(c => c.key === props.data.choice_key)
    if (!choice) throw new Error('Связанный выбор не найден.')
    let rows = choice.options || []
    if (choice.source === 'suggest') { await suggests.ensure(choice.from_suggest_id); rows = suggests.items(choice.from_suggest_id).map(s => ({ value: String(s.id), label: s.value })) }
    if (choice.source === 'suggest_union') {
      await Promise.all(choice.suggest_sources.map(s => suggests.ensure(s.suggest_id)))
      rows = choice.suggest_sources.flatMap(s => suggests.items(s.suggest_id).map(o => ({ value: `${s.prefix}:${o.id}`, label: `${o.value} · ${s.label}` })))
    }
    if (choice.source === 'item') {
      const result = await itemsApi.listAll(choice.from_item_type_id, {}, parseItemChoiceFilter(choice.item_filter) || {})
      rows = result.items.map(i => ({ value: String(i.id), label: i.name }))
    }
    if (request === version) options.value = rows
  } catch (e) { if (request === version) error.value = e.message || 'Не удалось загрузить варианты.' }
  finally { if (request === version) loading.value = false }
}
watch(() => [props.data.source_item_id, props.data.choice_key], load, { immediate: true })
function add(value) { if (value) props.data.options = [...(props.data.options || []), { value, kind: 'resistance' }] }
function remove() { props.data.options.splice(pending.value, 1); pending.value = null }
const validationKey = Symbol('choice-defense')
watchEffect(() => editor.setValidationError?.(validationKey, !props.data.source_item_id || !props.data.choice_key || !props.data.options?.length || props.data.options.some(o => !o.damage_type || !o.kind) ? 'Защита по выбору: укажите связанный выбор и защиты для его вариантов.' : ''))
onScopeDispose(() => { version++; editor.setValidationError?.(validationKey, '') })
</script>
