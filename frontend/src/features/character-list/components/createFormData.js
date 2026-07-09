function clone(value) {
  if (value == null) return value
  return JSON.parse(JSON.stringify(value))
}

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function pathParts(path) {
  if (Array.isArray(path)) return path
  return String(path || '').split('.').filter(Boolean)
}

function ensureContainer(parent, key, nextKey) {
  if (!isPlainObject(parent[key]) && !Array.isArray(parent[key])) {
    parent[key] = /^\d+$/.test(String(nextKey)) ? [] : {}
  }
  return parent[key]
}

export function setByPath(target, path, value) {
  const parts = pathParts(path)
  if (!parts.length) return

  let node = target
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]
    node = ensureContainer(node, key, parts[i + 1])
  }
  node[parts[parts.length - 1]] = clone(value)
}

function dedupeAppend(current, incoming) {
  const result = Array.isArray(current) ? clone(current) : []
  const values = Array.isArray(incoming) ? incoming : [incoming]

  const allStrings = result.every(v => typeof v === 'string') && values.every(v => typeof v === 'string')
  if (allStrings) {
    const seen = new Set(result)
    values.forEach(v => {
      if (!seen.has(v)) {
        seen.add(v)
        result.push(v)
      }
    })
    return result
  }

  const allHaveId = result.concat(values).every(v => isPlainObject(v) && v.id != null)
  if (allHaveId) {
    const seen = new Set(result.map(v => v.id))
    values.forEach(v => {
      if (!seen.has(v.id)) {
        seen.add(v.id)
        result.push(clone(v))
      }
    })
    return result
  }

  values.forEach(v => result.push(clone(v)))
  return result
}

function addValue(current, incoming) {
  if (current == null) return clone(incoming)

  if (Array.isArray(current) || Array.isArray(incoming)) {
    return dedupeAppend(current, incoming)
  }

  if (typeof current === 'number' && typeof incoming === 'number') {
    return current + incoming
  }

  if (isPlainObject(current) && isPlainObject(incoming)) {
    const result = clone(current)
    applyAdd(result, incoming)
    return result
  }

  return clone(incoming)
}

function applySet(target, patch, prefix = []) {
  Object.entries(patch || {}).forEach(([key, value]) => {
    const path = prefix.concat(key)
    if (isPlainObject(value) && !Array.isArray(target[key])) {
      if (!isPlainObject(target[key])) target[key] = {}
      applySet(target[key], value)
    } else {
      setByPath(target, path, value)
    }
  })
}

function applyAdd(target, patch) {
  Object.entries(patch || {}).forEach(([key, value]) => {
    target[key] = addValue(target[key], value)
  })
}

function applyRules(data, form, values) {
  const fields = form.fields || []
  fields.forEach(field => {
    if (!field.rules_preset) return
    const value = values[field.path_to]
    const rules = field.rules_preset[value]
    if (!rules) return
    if (rules.set) applySet(data, rules.set)
    if (rules.add) applyAdd(data, rules.add)
  })
}

export function buildCharacterData(form, values) {
  const charValues = clone(form?.preset || {})

  const fields = form?.fields || []
  fields.forEach(field => {
    if (!field.path_to) return
    const value = values[field.path_to]
    if (value !== undefined && value !== null && value !== '') {
      setByPath(charValues, field.path_to, value)
    }
  })

  applyRules(charValues, form || {}, values || {})
  return { values: charValues }
}

export function firstFormName(form, values) {
  const nameField = (form?.fields || []).find(f => f.path_to === 'name')
  return (nameField ? values[nameField.path_to] : '') || ''
}
