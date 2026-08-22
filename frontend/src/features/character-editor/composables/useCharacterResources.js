import { computed, ref, watch } from 'vue'

import { itemsApi } from '@/shared/api/itemsApi'
import {
  collectCharacterResources,
  DND_CHARACTER_RESOURCE_SOURCES,
  resourceItemIds,
  restoreCharacterResources,
  setCharacterResourceAvailable,
} from '@/features/character-editor/lib/characterResources'

export function useCharacterResources(values, sources = DND_CHARACTER_RESOURCE_SOURCES) {
  const itemsById = ref(new Map())
  let hydrationPromise = null

  function rememberItems(items) {
    if (!Array.isArray(items) || !items.length) return
    const next = new Map(itemsById.value)
    for (const item of items) next.set(String(item.id), item)
    itemsById.value = next
  }

  async function ensureItems(ids = resourceItemIds(values.value, sources)) {
    const requested = [...new Set(ids.map(String))]
    let missing = requested.filter((id) => !itemsById.value.has(id))
    if (!missing.length) return { items: requested.map((id) => itemsById.value.get(id)).filter(Boolean) }

    if (hydrationPromise) await hydrationPromise
    missing = missing.filter((id) => !itemsById.value.has(id))
    if (!missing.length) return { items: requested.map((id) => itemsById.value.get(id)).filter(Boolean) }

    const request = itemsApi.byIds(missing)
      .then((response) => {
        rememberItems(response?.items || [])
        return response || { items: [] }
      })
      .catch(() => ({ items: [] }))
    hydrationPromise = request
    try {
      await request
    } finally {
      if (hydrationPromise === request) hydrationPromise = null
    }
    return { items: requested.map((id) => itemsById.value.get(id)).filter(Boolean) }
  }

  watch(
    () => resourceItemIds(values.value, sources).join(','),
    () => { ensureItems() },
    { immediate: true },
  )

  const resources = computed(() => collectCharacterResources(values.value, itemsById.value, sources))

  return {
    resources,
    itemsById,
    ensureItems,
    rememberItems,
    item(id) { return itemsById.value.get(String(id)) || null },
    setAvailable(resourceKey, available) {
      return setCharacterResourceAvailable(values.value, itemsById.value, resourceKey, available, sources)
    },
    async restore(kind) {
      await ensureItems()
      return restoreCharacterResources(values.value, itemsById.value, kind, sources)
    },
  }
}
