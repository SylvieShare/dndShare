function cloneDocument(value) {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value))
}

/**
 * Bounded snapshot history for character-sheet actions. The view records the
 * document immediately before a mutation; undo returns an isolated copy so a
 * later reactive update cannot mutate an older history entry.
 */
export function createCharacterUndoHistory(limit = 60) {
  const entries = []

  function record(document) {
    if (!document) return
    entries.push(cloneDocument(document))
    if (entries.length > limit) entries.splice(0, entries.length - limit)
  }

  function undo() {
    const previous = entries.pop()
    return previous == null ? null : cloneDocument(previous)
  }

  function clear() {
    entries.splice(0)
  }

  return {
    record,
    undo,
    clear,
    get size() { return entries.length },
  }
}
