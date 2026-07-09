import { defineStore } from 'pinia'
import { fetchGet } from '@/shared/api/http'

// Per-typeId inflight promises for batch ensure().
// Each promise resolves once the cache for that typeId is populated.
const ensureInflight = new Map()
const ensureDeferreds = new Map()
let batchQueue = new Set()
let batchScheduled = false

// Per-(typeId, sortedIdsKey) inflight promises for ensureItems().
const itemsInflight = new Map()

function makeDeferred() {
  let resolve, reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

export const useSuggestStore = defineStore('suggest', {
  state: () => ({
    cache: {},
  }),
  getters: {
    items: state => typeId => (typeId != null ? state.cache[typeId] : null) || [],
    loaded: state => typeId => typeId != null && state.cache[typeId] !== undefined,
  },
  actions: {
    set(typeId, items) {
      this.cache = { ...this.cache, [typeId]: items }
    },
    addItem(typeId, item) {
      const list = this.cache[typeId]
      if (list) this.cache = { ...this.cache, [typeId]: [...list, item] }
    },
    removeItem(typeId, id) {
      const list = this.cache[typeId]
      if (list) this.cache = { ...this.cache, [typeId]: list.filter(i => i.id !== id) }
    },

    ensure(typeId) {
      if (typeId == null) return Promise.resolve()
      if (this.cache[typeId] !== undefined) return Promise.resolve()
      const existing = ensureInflight.get(typeId)
      if (existing) return existing

      const deferred = makeDeferred()
      ensureInflight.set(typeId, deferred.promise)
      ensureDeferreds.set(typeId, deferred)
      batchQueue.add(typeId)

      if (!batchScheduled) {
        batchScheduled = true
        Promise.resolve().then(() => this._flushBatch())
      }

      return deferred.promise
    },

    _flushBatch() {
      batchScheduled = false
      const ids = [...batchQueue]
      batchQueue = new Set()
      if (!ids.length) return

      fetchGet('/suggest/batch?typeIds=' + ids.join(',')).then(res => {
        const map = res?.items || {}
        for (const id of ids) {
          this.set(id, map[id] || [])
          const d = ensureDeferreds.get(id)
          ensureInflight.delete(id)
          ensureDeferreds.delete(id)
          d?.resolve()
        }
      }).catch(err => {
        for (const id of ids) {
          const d = ensureDeferreds.get(id)
          ensureInflight.delete(id)
          ensureDeferreds.delete(id)
          d?.reject(err)
        }
      })
    },

    async ensureItems(typeId, ids) {
      if (typeId == null) return
      const wanted = (Array.isArray(ids) ? ids : [ids])
        .filter(v => v != null && v !== '')
        .map(v => Number(v))
        .filter(v => Number.isFinite(v))
      if (!wanted.length) return

      await this.ensure(typeId)

      const known = new Set((this.cache[typeId] || []).map(i => Number(i.id)))
      const missing = [...new Set(wanted)].filter(id => !known.has(id))
      if (!missing.length) return

      missing.sort((a, b) => a - b)
      const key = `${typeId}|${missing.join(',')}`
      const existing = itemsInflight.get(key)
      if (existing) return existing

      const promise = (async () => {
        try {
          const res = await fetchGet(`/suggest/${typeId}/items?ids=` + missing.join(','))
          const items = res?.items || []
          if (items.length) {
            const known2 = new Set((this.cache[typeId] || []).map(i => Number(i.id)))
            const merged = [
              ...(this.cache[typeId] || []),
              ...items.filter(i => !known2.has(Number(i.id))),
            ]
            this.cache = { ...this.cache, [typeId]: merged }
          }
        } finally {
          itemsInflight.delete(key)
        }
      })()
      itemsInflight.set(key, promise)
      return promise
    },
  },
})
