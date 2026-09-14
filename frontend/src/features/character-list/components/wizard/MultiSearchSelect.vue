<template>
  <SearchMultiSelect
    :model-value="selected"
    :options="choices"
    :limit="limit"
    :label="placeholder"
    :placeholder="placeholder"
    :allow-create="allowCreate && suggestTypeId != null"
    :creating="creating"
    empty-label="Ничего не найдено"
    remove-label="Убрать"
    create-label="Добавить"
    @update:model-value="update"
    @create="create"
  />
</template>
<script setup>
import { computed, ref } from 'vue'
import { SearchMultiSelect } from '@sylvieshare/share-ui'
import { fetchPost } from '@/shared/api/http'
import { useSuggestStore } from '@/stores/suggest'
const props = defineProps({
  options: { type: Array, default: () => [] },
  selected: { type: Array, default: () => [] },
  limit: { type: Number, default: 0 },
  placeholder: { type: String, default: 'Поиск…' },
  suggestTypeId: { type: [Number, String], default: null },
  allowCreate: { type: Boolean, default: false },
})
const emit = defineEmits(['toggle'])
const creating = ref(false)
const choices = computed(() => props.options.map(option => ({ value: option.id, label: option.name })))
function update(values) {
  const before = new Set(props.selected.map(String)), after = new Set(values.map(String))
  for (const value of values) if (!before.has(String(value))) emit('toggle', value)
  for (const value of props.selected) if (!after.has(String(value))) emit('toggle', value)
}
async function create(value) {
  if (!props.allowCreate || props.suggestTypeId == null || creating.value) return
  creating.value = true
  try {
    const item = await fetchPost('/suggest/' + props.suggestTypeId, { value })
    if (!item?.id) return
    useSuggestStore().addItem(props.suggestTypeId, item)
    emit('toggle', item.id)
  } finally { creating.value = false }
}
</script>
