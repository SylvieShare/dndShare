// Storage failures never discard the in-memory queue. Account-scoped keys are
// supplied by the feature; confirmed documents leave no outbox record behind.
export function createDocumentOutbox(storageKey) {
  let resolvedKey
  const key = () =>
    resolvedKey ||
    (resolvedKey = typeof storageKey === 'function' ? storageKey() : storageKey)
  return {
    read() {
      try {
        const id = key()
        return id
          ? JSON.parse(globalThis.localStorage?.getItem(id) || 'null')
          : null
      } catch {
        return null
      }
    },
    write(value) {
      try {
        const id = key()
        if (!id) return
        if (value) globalThis.localStorage?.setItem(id, JSON.stringify(value))
        else globalThis.localStorage?.removeItem(id)
      } catch {
        /* The queue remains available in memory. */
      }
    },
  }
}
