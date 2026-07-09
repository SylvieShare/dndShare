import { reactive } from 'vue'
import { itemsApi } from '@/shared/api/itemsApi'

const cache = reactive({})
const pending = new Set()

export function itemName(id) {
  if (id == null) return null
  return cache[id] ?? null
}

export async function ensureItemNames(ids) {
  const missing = [...new Set(ids)]
    .filter(id => id != null)
    .filter(id => !(id in cache) && !pending.has(id))
  if (!missing.length) return
  for (const id of missing) pending.add(id)
  try {
    const res = await itemsApi.byIds(missing)
    for (const it of res?.items || []) cache[it.id] = it.name
  } finally {
    for (const id of missing) pending.delete(id)
  }
}
