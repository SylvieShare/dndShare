import { reactive, ref, watch } from 'vue'
import { itemsApi } from '@/shared/api/itemsApi'
import { allCatalogIds } from '../lib/itemSection'

export function useInventoryCatalog(model) {
  const catalog = reactive({}), loading = ref(true), error = ref('')
  let request = 0
  async function reload() {
    const token = ++request
    const missing = allCatalogIds(model()).filter(id => !catalog[id])
    error.value = ''
    try {
      if (missing.length) {
        const items = (await itemsApi.byIds(missing)).items || []
        for (const item of items) catalog[item.id] = item
        if (missing.some(id => !catalog[id])) throw new Error('Missing item reference')
      }
    } catch {
      if (token === request) error.value = 'Не удалось загрузить предметы и их основы.'
    } finally { if (token === request) loading.value = false }
  }
  watch(() => allCatalogIds(model()).join(','), reload, { immediate: true })
  return { catalog, loading, error, reload }
}
