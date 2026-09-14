import { computed } from 'vue'
import { findField, getSuggestId } from '@/features/handbook/objects/lib/schemaFields'
import { useSuggestStore } from '@/stores/suggest'

const fieldsByType = new WeakMap(), indexesByItems = new WeakMap()
const EMPTY_ITEMS = [], EMPTY_INDEX = new Map()

export function suggestItemIndex(items) {
  if (!items?.length) return EMPTY_INDEX
  let index = indexesByItems.get(items)
  if (!index) {
    // The computed also tracks in-place reactive changes, not just replacements.
    index = computed(() => new Map(items.map(item => [String(item.id), item])))
    indexesByItems.set(items, index)
  }
  return index.value
}

function suggestId(type, fieldKey) {
  if (!type) return null
  let fields = fieldsByType.get(type)
  if (!fields) { fields = new Map(); fieldsByType.set(type, fields) }
  if (!fields.has(fieldKey)) fields.set(fieldKey, computed(() => getSuggestId(findField(type.fields, fieldKey))))
  return fields.get(fieldKey).value
}

export function useSchemaSuggests(getType) {
  const suggestStore = useSuggestStore()
  function suggestItems(fieldKey) {
    const id = suggestId(getType(), fieldKey)
    return id != null ? suggestStore.items(id) : EMPTY_ITEMS
  }
  return { suggestItems, suggestIndex: fieldKey => suggestItemIndex(suggestItems(fieldKey)) }
}
