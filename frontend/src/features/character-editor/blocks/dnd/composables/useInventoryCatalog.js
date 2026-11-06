import { reactive, ref, watch } from 'vue'
import { useCharacterItemCatalog } from '../../../composables/useCharacterItemCatalog'
import { allCatalogIds } from '../lib/itemSection'

export function useInventoryCatalog(model) {
  const shared = useCharacterItemCatalog()
  const catalog = reactive(shared.snapshot()), loading = ref(true), error = ref('')
  const pending = reactive(new Set()), resolved = reactive(new Set())
  const itemLoading = entry => [entry.item_id, entry.magic_item_id].filter(Boolean).some(id => !catalog[id] && (pending.has(String(id)) || !resolved.has(String(id))))
  let request = 0
  async function reload() {
    const token = ++request
    const missing = allCatalogIds(model()).filter(id => !catalog[id])
    error.value = ''
    missing.forEach(id => pending.add(String(id)))
    try {
      if (missing.length) {
        const response = await shared.load(missing)
        for (const item of response.items || []) catalog[item.id] = item
        if (response.failed) throw new Error('Catalogue request failed')
        // A successful batch can omit inaccessible or deleted records. Each affected cell owns its empty state.
      }
    } catch {
      if (token === request) error.value = 'Не удалось загрузить предметы и их основы.'
    } finally {
      missing.forEach(id => { pending.delete(String(id)); resolved.add(String(id)) })
      if (token === request) loading.value = false
    }
  }
  watch(() => allCatalogIds(model()).join(','), reload, { immediate: true })
  return { catalog, loading, error, reload, itemLoading }
}
