import {
  documentDiff,
  documentTarget,
  copyDocument,
  sameDocument,
  applyDocumentPatches,
} from './documentPatch'

function guardedValue(document, operation) {
  let target
  try {
    target = documentTarget(document, operation.path, true)
  } catch {
    target = { exists: false }
  }
  const value =
    operation.op === 'order' && target.exists
      ? target.value.map((item) => item[operation.idField])
      : target.value
  return {
    exists: target.exists,
    ...(target.exists ? { value: copyDocument(value) } : {}),
  }
}
const guards = (document, operations) =>
  operations.map((operation) => ({
    operation,
    ...guardedValue(document, operation),
  }))
export function createDocumentChange(before, after) {
  const forward = documentDiff(before, after),
    inverse = documentDiff(after, before)
  return {
    forward,
    inverse,
    before: guards(before, forward),
    after: guards(after, inverse),
  }
}
export function applyDocumentChange(document, change, forward = true) {
  for (const guard of forward ? change.before : change.after) {
    const { operation, ...expected } = guard
    if (!sameDocument(guardedValue(document, operation), expected))
      throw Object.assign(
        new Error(
          'Данные изменились после этой операции; отмена не перезаписывает новые правки',
        ),
        { status: 409 },
      )
  }
  return applyDocumentPatches(
    document,
    forward ? change.forward : change.inverse,
  )
}
