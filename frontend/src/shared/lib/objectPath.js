// Dotted-path get/set on plain objects. Shared by the session participant views
// and character-list cards, which each carried an identical copy. `getByPath`
// returns null for a missing segment (handbook schema uses its own
// undefined-returning variant in schemaFields.js — keep them separate).

export function getByPath(obj, path) {
  if (!path) return null
  return path.split('.').reduce((cur, key) => cur?.[key], obj) ?? null
}

export function setDeep(obj, path, value) {
  const parts = String(path).split('.')
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i]
    if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {}
    cur = cur[k]
  }
  cur[parts[parts.length - 1]] = value
}
