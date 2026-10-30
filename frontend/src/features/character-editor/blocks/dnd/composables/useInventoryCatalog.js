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
        const items = (await shared.load(missing)).items || []
        for (const item of items) catalog[item.id] = item
        if (missing.some(id => !catalog[id])) throw new Error('Missing item reference')
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
