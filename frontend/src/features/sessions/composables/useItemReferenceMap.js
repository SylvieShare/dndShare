import { onBeforeUnmount, shallowRef, watch } from 'vue'
import { itemsApi } from '@/shared/api/itemsApi'

export function useItemReferenceMap(itemIds) {
  const itemsById = shallowRef(new Map())
  let requestId = 0
  let stopped = false

  watch(
    () => [...new Set((itemIds.value || []).filter(id => id != null).map(String))].sort().join(','),
    async key => {
      const currentRequest = ++requestId
      if (!key) {
        itemsById.value = new Map()
        return
      }
      const response = await itemsApi.byIds(key.split(',')).catch(() => null)
      if (stopped || currentRequest !== requestId || !response) return
      itemsById.value = new Map((response.items || []).map(item => [String(item.id), item]))
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    stopped = true
    requestId += 1
  })

  function itemById(id) {
    return itemsById.value.get(String(id)) ?? null
  }

  return { itemsById, itemById }
}
