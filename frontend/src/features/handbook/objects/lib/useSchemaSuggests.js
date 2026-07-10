import { findField, getSuggestId } from '@/features/handbook/objects/lib/schemaFields'
import { useSuggestStore } from '@/stores/suggest'

// Reads suggest items for a schema field by key: finds the field in the object
// type's schema, resolves its suggest id and returns the cached suggest rows.
// `getType` is a getter (e.g. `() => props.type`) so it stays reactive.
export function useSchemaSuggests(getType) {
  const suggestStore = useSuggestStore()

  function suggestItems(fieldKey) {
    const sid = getSuggestId(findField(getType()?.fields, fieldKey))
    return sid != null ? suggestStore.items(sid) : []
  }

  return { suggestItems }
}
