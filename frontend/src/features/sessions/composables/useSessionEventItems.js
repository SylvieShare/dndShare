import { onScopeDispose, ref, watch } from 'vue'
import { itemsApi } from '@/shared/api/itemsApi'
import { sessionEventEntity } from '../lib/sessionEventEntity'

export function useSessionEventItems(events) {
  const items = ref({})
  let sequence = 0
  watch(() => [...new Set(events.value.map(event => sessionEventEntity(event)?.itemId).filter(Boolean))], async ids => {
    const request = ++sequence
    const missing = ids.filter(id => !items.value[id])
    if (!missing.length) return
    try {
      const result = await itemsApi.byIds(missing)
      if (request !== sequence) return
      items.value = { ...items.value, ...Object.fromEntries((result.items || []).map(item => [item.id, item])) }
    } catch { /* Names stored in events remain readable; the reference window can retry loading. */ }
  }, { immediate: true })
  onScopeDispose(() => { sequence++ })
  return { items }
}
