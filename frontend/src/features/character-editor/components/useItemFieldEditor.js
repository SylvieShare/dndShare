import { useSuggestStore } from '@/stores/suggest'
import { ensureItemNames, itemName } from '@/features/handbook/objects/lib/itemNames'
import { getSuggestId } from '@/features/handbook/objects/lib/schemaFields'

export const itemFieldEditorKey = Symbol('itemFieldEditor')

export function useItemFieldEditor(openItemPicker) {
  const suggestStore = useSuggestStore()
  return {
    openItemPicker,
    ensureItemNames,
    getSuggestId,
    getSuggests: id => suggestStore.items(id) || [],
    itemRefLabel: id => id == null ? 'Выбрать предмет' : itemName(id) || `#${id}`,
  }
}
