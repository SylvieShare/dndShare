import { defineStore } from 'pinia'
import { fetchGet } from '@/shared/api/http'

// In-flight promise for the single /item-types request.
let ensureAllInflight = null

export function relatedItemTypeIds(types, rootId, { includeRoot = true } = {}) {
  const normalizedRoot = Number(rootId)
  if (!Number.isFinite(normalizedRoot)) return []
  const byParent = new Map()
  for (const type of (types || [])) {
    const parent = Number(type?.parentTypeId)
    if (!Number.isFinite(parent)) continue
    const children = byParent.get(parent) || []
    children.push(Number(type.id))
    byParent.set(parent, children)
  }
  const result = includeRoot ? [normalizedRoot] : []
  const seen = new Set(result)
  const queue = [...(byParent.get(normalizedRoot) || [])]
  while (queue.length) {
    const id = queue.shift()
    if (seen.has(id)) continue
    seen.add(id)
    result.push(id)
    queue.push(...(byParent.get(id) || []))
  }
  return result
}

export const useItemTypesStore = defineStore('itemTypes', {
  state: () => ({
    // null until first fetch resolves; then an array of all item types.
    types: null,
  }),
  getters: {
    allTypes: state => state.types || [],
    typesBySource: state => sourceId => {
      if (sourceId == null) return state.types || []
      return (state.types || []).filter(t => t.sourceId === sourceId)
    },
    getType: state => id => (state.types || []).find(t => t.id === id) || null,
    childrenOf: state => id => (state.types || []).filter(t => Number(t.parentTypeId) === Number(id)),
    relatedTypeIds: state => id => relatedItemTypeIds(state.types || [], id),
  },
  actions: {
    async ensureAll() {
      if (this.types !== null) return this.types
      if (ensureAllInflight) return ensureAllInflight
      ensureAllInflight = (async () => {
        try {
          const res = await fetchGet('/item-types')
          this.types = res?.types || []
          return this.types
        } finally {
          ensureAllInflight = null
        }
      })()
      return ensureAllInflight
    },
    // Returns types for a given source; loads /item-types once if needed.
    async ensureBySource(sourceId) {
      await this.ensureAll()
      return this.typesBySource(sourceId)
    },
    async ensureType(id) {
      await this.ensureAll()
      return this.getType(id)
    },
    // Invalidate cache (e.g. after admin edit of item types).
    reset() {
      this.types = null
    },
  },
})
