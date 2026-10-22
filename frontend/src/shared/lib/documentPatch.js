const blocked = new Set(['__proto__', 'prototype', 'constructor'])
export const copyDocument = (value) =>
  value === undefined ? undefined : JSON.parse(JSON.stringify(value))
export function sameDocument(a, b) {
  if (a === b) return true
  if (
    !a ||
    !b ||
    typeof a !== 'object' ||
    typeof b !== 'object' ||
    Array.isArray(a) !== Array.isArray(b)
  )
    return false
  const keys = Object.keys(a).filter((key) => a[key] !== undefined)
  const other = Object.keys(b).filter((key) => b[key] !== undefined)
  return (
    keys.length === other.length &&
    keys.every((key) => sameDocument(a[key], b[key]))
  )
}
const identity = (value) => JSON.stringify(value)
const object = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const validId = (value) =>
  typeof value === 'string' || typeof value === 'number'

export function collectionIdentity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || (!a.length && !b.length))
    return null
  return (
    ['uid', 'id', 'key', 'charId'].find((field) =>
      [a, b].every((list) => {
        const ids = list.map((item) => object(item) && item[field])
        return (
          ids.every(validId) && new Set(ids.map(identity)).size === ids.length
        )
      }),
    ) || null
  )
}

export function documentDiff(before, after, path = []) {
  if (sameDocument(before, after)) return []
  if (object(before) && object(after)) {
    return [...new Set([...Object.keys(before), ...Object.keys(after)])]
      .sort()
      .flatMap((key) => {
        if (blocked.has(key)) throw new Error('Forbidden document path')
        if (!(key in after)) return [{ op: 'remove', path: [...path, key] }]
        if (!(key in before))
          return [
            {
              op: 'set',
              path: [...path, key],
              value: copyDocument(after[key]),
            },
          ]
        return documentDiff(before[key], after[key], [...path, key])
      })
  }
  const idField = collectionIdentity(before, after)
  if (!idField) return [{ op: 'set', path, value: copyDocument(after) }]
  const old = new Map(before.map((item) => [identity(item[idField]), item]))
  const next = new Map(after.map((item) => [identity(item[idField]), item]))
  const changes = before
    .filter((item) => !next.has(identity(item[idField])))
    .map((item) => ({
      op: 'remove',
      path: [...path, { idField, id: item[idField] }],
    }))
  for (let i = after.length - 1; i >= 0; i--) {
    const item = after[i],
      selector = { idField, id: item[idField] },
      previous = old.get(identity(item[idField]))
    if (!previous)
      changes.push({
        op: 'insert',
        path: [...path, selector],
        value: copyDocument(item),
        ...(i + 1 < after.length ? { beforeId: after[i + 1][idField] } : {}),
      })
    else changes.push(...documentDiff(previous, item, [...path, selector]))
  }
  const commonOld = before
    .filter((item) => next.has(identity(item[idField])))
    .map((item) => item[idField])
  const commonNext = after
    .filter((item) => old.has(identity(item[idField])))
    .map((item) => item[idField])
  if (!sameDocument(commonOld, commonNext))
    changes.push({
      op: 'order',
      path,
      idField,
      value: after.map((item) => item[idField]),
    })
  return changes
}

export function documentTarget(root, path, missing = false) {
  if (!Array.isArray(path) || path.length > 64)
    throw new Error('Invalid document path')
  let value = root,
    parent,
    key
  for (let i = 0; i < path.length; i++) {
    const part = path[i]
    parent = value
    if (typeof part === 'string') {
      if (blocked.has(part) || !object(parent))
        throw new Error('Invalid document path')
      key = part
    } else {
      if (
        !object(part) ||
        !Array.isArray(parent) ||
        typeof part.idField !== 'string' ||
        blocked.has(part.idField) ||
        !validId(part.id)
      )
        throw new Error('Invalid collection selector')
      const indexes = parent.flatMap((item, index) =>
        item?.[part.idField] === part.id ? [index] : [],
      )
      if (indexes.length > 1) throw new Error('Duplicate collection identity')
      key = indexes.length ? indexes[0] : -1
    }
    const exists = key !== -1 && Object.hasOwn(parent, key)
    if (!exists && (!missing || i !== path.length - 1))
      throw new Error('Document path no longer exists')
    value = exists ? parent[key] : undefined
  }
  return {
    value,
    parent,
    key,
    exists: path.length ? key !== -1 && Object.hasOwn(parent, key) : true,
  }
}

export function applyDocumentPatches(root, patches) {
  if (!Array.isArray(patches) || patches.length > 10000)
    throw new Error('Too many document operations')
  for (const patch of patches) {
    const target = documentTarget(
      root,
      patch.path,
      patch.op === 'set' || patch.op === 'insert',
    )
    if (patch.op === 'set') {
      if (!Object.hasOwn(patch, 'value')) throw new Error('Missing patch value')
      if (!patch.path.length) root = copyDocument(patch.value)
      else if (Array.isArray(target.parent) && target.key === -1)
        throw new Error('Use insert for a new collection entry')
      else target.parent[target.key] = copyDocument(patch.value)
    } else if (patch.op === 'remove') {
      if (!patch.path.length || !target.exists)
        throw new Error('Document path no longer exists')
      if (Array.isArray(target.parent))
        target.parent.splice(Number(target.key), 1)
      else delete target.parent[target.key]
    } else if (patch.op === 'insert') {
      const selector = patch.path.at(-1)
      if (
        !Array.isArray(target.parent) ||
        typeof selector !== 'object' ||
        target.exists ||
        patch.value?.[selector.idField] !== selector.id
      )
        throw new Error('Invalid collection insertion')
      const index = Object.hasOwn(patch, 'beforeId')
        ? target.parent.findIndex(
            (item) => item?.[selector.idField] === patch.beforeId,
          )
        : target.parent.length
      if (index < 0) throw new Error('Insertion anchor no longer exists')
      target.parent.splice(index, 0, copyDocument(patch.value))
    } else if (patch.op === 'order') {
      if (
        !Array.isArray(target.value) ||
        !Array.isArray(patch.value) ||
        typeof patch.idField !== 'string' ||
        !patch.idField ||
        blocked.has(patch.idField)
      )
        throw new Error('Invalid collection order')
      const items = new Map(
        target.value.map((item) => [identity(item?.[patch.idField]), item]),
      )
      if (
        items.size !== target.value.length ||
        patch.value.length !== items.size ||
        new Set(patch.value.map(identity)).size !== items.size ||
        patch.value.some((id) => !items.has(identity(id)))
      )
        throw new Error('Collection membership changed')
      target.value.splice(
        0,
        target.value.length,
        ...patch.value.map((id) => items.get(identity(id))),
      )
    } else throw new Error('Unknown document operation')
  }
  return root
}

// Rebase only independent local edits. Changes already present after a lost
// acknowledgement are treated as applied; overlapping edits stay explicit.
export function rebaseDocumentChanges(previousBase, nextBase, localPatches, canonicalize) {
  try {
    if (canonicalize) {
      const desired = applyDocumentPatches(copyDocument(previousBase), localPatches)
      previousBase = canonicalize(copyDocument(previousBase))
      nextBase = canonicalize(copyDocument(nextBase))
      localPatches = documentDiff(previousBase, canonicalize(desired))
    }
    return rebaseChanges(previousBase, nextBase, localPatches)
  } catch (error) {
    throw Object.assign(error, { status: 409 })
  }
}
function rebaseChanges(previousBase, nextBase, localPatches) {
  let previous = copyDocument(previousBase),
    next = copyDocument(nextBase)
  const retained = []
  for (const patch of localPatches) {
    const old = documentTarget(previous, patch.path, true)
    const current = documentTarget(next, patch.path, true)
    const desired = applyDocumentPatches(copyDocument(previous), [patch])
    const after = documentTarget(desired, patch.path, true)
    if (
      current.exists === after.exists &&
      sameDocument(rebaseValue(current, patch), rebaseValue(after, patch))
    ) {
      previous = desired
      continue
    }
    if (
      old.exists !== current.exists ||
      !sameDocument(rebaseValue(old, patch), rebaseValue(current, patch))
    )
      throw Object.assign(
        new Error('Одни и те же данные изменены в другой вкладке'),
        { status: 409, conflictPath: patch.path },
      )
    next = applyDocumentPatches(next, [patch])
    previous = desired
    retained.push(patch)
  }
  return { data: next, patches: retained }
}

function rebaseValue(target, patch) {
  return patch.op === 'order' && target.exists
    ? target.value.map((item) => item[patch.idField])
    : target.value
}
