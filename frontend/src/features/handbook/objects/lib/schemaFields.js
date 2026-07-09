export function getSuggestId(field) {
  if (!field) return null
  return field.suggest_id ?? field.suggest_type_id ?? field.suggestTypeId ?? null
}

export function numberOrNull(value) {
  if (value === '' || value == null) return null
  const n = Number(value)
  return Number.isNaN(n) ? null : n
}

export function cloneDefault(value) {
  if (value == null || typeof value !== 'object') return value
  return JSON.parse(JSON.stringify(value))
}

export function isBooleanField(field) {
  return field?.type === 'bool' || field?.type === 'boolean'
}

export function isFieldVisible(field, data) {
  if (!field.show_on) return true
  const current = data[field.show_on.key]
  const expected = field.show_on.value
  const currentValues = Array.isArray(current) ? current : [current]
  const expectedValues = Array.isArray(expected) ? expected : [expected]
  return currentValues.some((value) => expectedValues.includes(value))
}

export function defaultDataForFields(fields) {
  const data = {}
  for (const field of fields || []) {
    if (Object.prototype.hasOwnProperty.call(field, 'default')) {
      data[field.key] = cloneDefault(field.default)
    } else if (field.type === 'item') {
      data[field.key] = null
    }
  }
  return data
}

export function normalizeDataForSave(data, fields) {
  const next = { ...data }
  for (const field of fields || []) {
    if (field.type === 'object' && next[field.key]) {
      next[field.key] = normalizeDataForSave(next[field.key], field.fields || [])
    } else if (field.type === 'object_array') {
      next[field.key] = (Array.isArray(next[field.key]) ? next[field.key] : [])
        .map(row => normalizeDataForSave(row || {}, field.fields || []))
    } else if (field.type === 'item') {
      next[field.key] = numberOrNull(next[field.key])
    }
  }
  return next
}

export function collectSuggestIds(fields) {
  const ids = new Set()
  for (const field of fields || []) {
    const sid = getSuggestId(field)
    if (sid != null) ids.add(sid)
    if (field.fields) for (const id of collectSuggestIds(field.fields)) ids.add(id)
  }
  return ids
}

export function findField(fields, key) {
  for (const f of fields || []) {
    if (f.key === key) return f
    const nested = findField(f.fields, key)
    if (nested) return nested
  }
  return null
}

// Walks the schema yielding leaf-or-container fields with their dotted data path
// (e.g. "combat.cr", "identity.is_legendary"). Recurses into `object` containers.
export function walkFieldsWithPath(fields, parentPath = '') {
  const out = []
  for (const f of fields || []) {
    const path = parentPath ? `${parentPath}.${f.key}` : f.key
    out.push({ field: f, path })
    if (f.type === 'object') {
      out.push(...walkFieldsWithPath(f.fields, path))
    }
  }
  return out
}

// Finds a field by its dotted path (recursing into `object` containers).
export function findFieldByPath(fields, path) {
  if (!path) return null
  const segments = String(path).split('.')
  let cur = fields || []
  let field = null
  for (const seg of segments) {
    field = (cur || []).find(f => f.key === seg) || null
    if (!field) return null
    cur = field.fields || []
  }
  return field
}

// Reads a value from data by dotted path. Returns undefined if a segment is missing.
export function getByPath(data, path) {
  if (!path) return undefined
  const segments = String(path).split('.')
  let cur = data
  for (const seg of segments) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = cur[seg]
  }
  return cur
}
