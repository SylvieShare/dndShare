import { createDeferredTask } from '@/shared/lib/deferredTask'

const MAX_CHARACTER_SNAPSHOTS = 3

export function characterSnapshotStorageKey(uuid) {
  return `dndshare.characterSnapshots.v1.${uuid}`
}

// Immutable JSON strings avoid serializing the previous snapshots on each flush.
export function createCharacterSnapshotRecorder(uuid, getData, options = {}) {
  let snapshots = null
  const key = characterSnapshotStorageKey(uuid)
  function record() {
    if (!uuid) return false
    try {
      const storage = options.storage || globalThis.localStorage
      const data = getData()
      if (!storage || !data) return false
      if (snapshots == null) {
        try {
          const saved = JSON.parse(storage.getItem(key) || '[]')
          snapshots = Array.isArray(saved) ? saved.slice(-MAX_CHARACTER_SNAPSHOTS).map(value => JSON.stringify(value)) : []
        } catch { snapshots = [] }
      }
      const serialized = JSON.stringify(data)
      if (snapshots.at(-1) === serialized) return true
      const next = [...snapshots, serialized].slice(-MAX_CHARACTER_SNAPSHOTS)
      storage.setItem(key, `[${next.join(',')}]`)
      snapshots = next
      return true
    } catch {
      // Quota/private-mode failures must not block editing or the server save.
      return false
    }
  }
  const task = createDeferredTask(record, options)
  const flush = () => task.flush()
  const visibilityChanged = () => { if (globalThis.document?.visibilityState === 'hidden') flush() }
  globalThis.window?.addEventListener('pagehide', flush)
  globalThis.document?.addEventListener('visibilitychange', visibilityChanged)
  return {
    schedule: task.schedule,
    flush,
    dispose() {
      flush()
      globalThis.window?.removeEventListener('pagehide', flush)
      globalThis.document?.removeEventListener('visibilitychange', visibilityChanged)
    },
  }
}
