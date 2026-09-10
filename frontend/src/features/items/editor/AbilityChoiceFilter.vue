<template>
  <div class="ability-action-fields">
    <FormField label="Ограничить доступные объекты" title="Например, оставить только заговоры или заклинания определённого класса."><ToggleSwitch v-model="enabled" aria-label="Ограничить доступные объекты" @update:model-value="v => { if (!v) delete data.item_filter }" /></FormField>
    <div v-if="enabled" class="ability-condition-fields">
      <div v-for="(value, key) in filter" :key="key" class="ability-action-fields">
        <div class="ability-row-heading"><strong>{{ label(key) }}</strong><RemoveButton icon="trash" :label="`Удалить условие ${label(key)}`" @click="pending = key" /></div>
        <AbilityRuleFields :fields="[valueField(key)]" :data="{ value }" @update:data="row => set(key, row.value)" />
      </div>
      <FormField label="Добавить условие" vertical title="Все добавленные условия должны выполняться."><FormSelect value="" aria-label="Добавить условие" @update:value="key => key && set(key, '')"><option value="">Выберите показатель</option><option v-for="f in available" :key="f.path" :value="f.path">{{ f.name }}</option></FormSelect></FormField>
    </div>
    <ConfirmDialog v-if="pending" title="Удалить условие?" message="Оно перестанет ограничивать доступные варианты." :z-index="(editor.zIndex || 4500) + 300" @confirm="remove" @close="pending = ''" @cancel="pending = ''" />
  </div>
</template>
<script setup>
import { computed, inject, ref, watch } from 'vue'
import { ConfirmDialog, FormField, FormSelect, RemoveButton, ToggleSwitch } from '@sylvieshare/share-ui'
import { useItemTypesStore } from '@/stores/itemTypes'
import { useSuggestStore } from '@/stores/suggest'
import { itemFieldEditorKey } from '@/features/character-editor/components/useItemFieldEditor'
import { getSuggestId } from '@/features/handbook/objects/lib/schemaFields'
import { parseItemChoiceFilter } from '@/features/items/lib/itemChoices'
import { choiceFilterFields } from './choiceFilterFields'
import AbilityRuleFields from './AbilityRuleFields.vue'
const props = defineProps({ data: Object })
const types = useItemTypesStore(), suggests = useSuggestStore(), editor = inject(itemFieldEditorKey, {})
const pending = ref(''), enabled = ref(!!props.data.item_filter)
const filter = computed(() => parseItemChoiceFilter(props.data.item_filter) || {})
const fields = computed(() => choiceFilterFields(types.getType(Number(props.data.from_item_type_id))?.fields))
const available = computed(() => fields.value.filter(f => !(f.path in filter.value)))
watch(fields, rows => { for (const f of rows) { const id = getSuggestId(f); if (id) suggests.ensure(id).catch(() => {}) } }, { immediate: true })
watch(() => fields.value.filter(f => f.type === 'item').flatMap(f => [filter.value[f.path]].flat()).filter(Boolean), ids => editor.ensureItemNames?.(ids)?.catch(() => {}), { immediate: true })
function label(key) { return fields.value.find(f => f.path === key)?.name || key }
function valueField(key) {
  const field = fields.value.find(f => f.path === key)
  return { ...field, key: 'value', name: 'Допустимое значение', type: Array.isArray(filter.value[key]) ? (getSuggestId(field) ? 'suggest_array' : 'text_array') : field?.type === 'suggest_array' ? 'suggest' : field?.type || 'text', hint: 'Показатель объекта должен совпасть с этим значением.', show_on: undefined }
}
function set(key, value) { props.data.item_filter = { ...filter.value, [key]: value } }
function remove() { const next = { ...filter.value }; delete next[pending.value]; props.data.item_filter = next; pending.value = '' }
</script>
