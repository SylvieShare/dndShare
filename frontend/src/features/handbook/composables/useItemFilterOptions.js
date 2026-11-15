import { ref, watch } from 'vue'
import { itemsApi } from '@/shared/api/itemsApi'

/** Reference filters share the list's edition, but not its publication selection. */
export function useItemFilterOptions(props) {
  const options = ref({})

  watch(() => [props.filterFields, props.sourceVersionId, props.allowLegacy], async ([fields, sourceVersionId, allowLegacy], _previous, onCleanup) => {
    let current = true
    onCleanup(() => { current = false })
    // Never offer IDs from the previous edition while the next one loads.
    options.value = {}
    const itemFields = (fields || []).filter(field => field.filter_item_type)
    const typeIds = [...new Set(itemFields.map(field => field.filter_item_type))]
    const scope = { sourceVersionId, contentSources: { allowLegacy: !!allowLegacy } }
    const entries = await Promise.all(typeIds.map(async typeId => {
      const response = await itemsApi.listAll(typeId, scope).catch(() => null)
      return [typeId, (response?.items || []).map(item => ({ value: item.id, label: item.name }))]
    }))
    if (!current) return
    const byType = new Map(entries)
    options.value = Object.fromEntries(itemFields.map(field => [field.path, byType.get(field.filter_item_type)]))
  }, { immediate: true })

  return options
}
