import {
  createDocumentChange,
  applyDocumentChange,
} from '@/shared/lib/documentHistory'
const durable = (value) =>
  Object.fromEntries(
    ['name', 'document', 'state']
      .filter((key) => value[key] !== undefined)
      .map((key) => [key, value[key]]),
  )
export const documentChanges = (before, after) =>
  createDocumentChange(durable(before), durable(after))
export const applyDocumentChanges = applyDocumentChange
