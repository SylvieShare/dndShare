import { defineStore } from 'pinia'
import { fetchGet } from '@/shared/api/http'

// In-flight promise for the single /item-types request.
let ensureAllInflight = null

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
