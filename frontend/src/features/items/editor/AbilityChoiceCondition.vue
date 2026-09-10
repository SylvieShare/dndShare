<template>
  <AbilityRuleFields :fields="fields" :data="data" @update:data="value => Object.assign(data, value)" />
</template>
<script setup>
import { computed, inject, watch } from 'vue'
import { useSuggestStore } from '@/stores/suggest'
import { itemFieldEditorKey } from '@/features/character-editor/components/useItemFieldEditor'
import AbilityRuleFields from './AbilityRuleFields.vue'
const props = defineProps({ data: Object })
const editor = inject(itemFieldEditorKey, {})
const store = useSuggestStore()
const choice = computed(() => editor.itemData?.choices?.find(c => c.key === props.data.choice_key))
watch(choice, c => { for (const id of [c?.from_suggest_id, ...(c?.suggest_sources || []).map(s => s.suggest_id)].filter(Boolean)) store.ensure(id).catch(() => {}) }, { immediate: true })
const options = computed(() => {
  const c = choice.value
  if (c?.source === 'suggest') return store.items(c.from_suggest_id).map(s => ({ value: String(s.id), label: s.value }))
  if (c?.source === 'suggest_union') return (c.suggest_sources || []).flatMap(source => store.items(source.suggest_id).map(s => ({ value: `${source.prefix}:${s.id}`, label: `${s.value} · ${source.label}` })))
  return (c?.options || []).map(o => ({ value: String(o.value), label: o.label }))
})
const fields = computed(() => [
  ...(props.data.target_from_choice && choice.value?.source === 'suggest_union' ? [{ key: 'choice_value_prefix', type: 'select', name: 'Какая часть выбора', options: (choice.value.suggest_sources || []).map(s => ({ value: s.prefix, label: s.label })), hint: 'Например, правило владения навыком использует только навыки из общего выбора.' }] : []),
  { key: 'choice_values', type: 'option_array', name: 'При каких ответах', options: options.value, hint: 'Ничего не выбрано — правило действует при любом ответе.' },
])
</script>
