const MAX_CHARACTER_SNAPSHOTS = 3

export function characterSnapshotStorageKey(uuid) {
  return `dndshare.characterSnapshots.v1.${uuid}`
}

export function recordCharacterSnapshot(uuid, data, storage) {
  if (!uuid || !data) return false
  if (!storage) {
    try {
      storage = globalThis.localStorage
    } catch {
      return false
    }
  }
  if (!storage) return false

  let snapshots = []
  try {
    const saved = JSON.parse(storage.getItem(characterSnapshotStorageKey(uuid)) || '[]')
    if (Array.isArray(saved)) snapshots = saved
  } catch {
    // A malformed or unreadable previous value must not block character editing.
  }

  try {
    const snapshot = JSON.parse(JSON.stringify(data))
    snapshots.push(snapshot)
    storage.setItem(
      characterSnapshotStorageKey(uuid),
      JSON.stringify(snapshots.slice(-MAX_CHARACTER_SNAPSHOTS)),
    )
    return true
  } catch {
    // Storage can be unavailable or full; the server save remains authoritative.
    return false
  }
}
