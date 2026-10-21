import {
  applyDocumentPatches,
  copyDocument,
  documentDiff,
} from '@/shared/lib/documentPatch'

export function createLiveRoster(
  participants,
  { pendingColors = () => new Set(), pendingOrder = () => false } = {},
) {
  let confirmed
  return (change) => {
    if (change.data !== undefined) confirmed = copyDocument(change.data)
    else {
      if (!confirmed) throw new Error('Не загружен состав сессии')
      confirmed = applyDocumentPatches(confirmed, change.patches || [])
    }
    const local = new Map(participants.value.map((row) => [row.charId, row]))
    let next = copyDocument(confirmed)
    for (const row of next)
      if (pendingColors().has(row.charId) && local.has(row.charId))
        row.color = local.get(row.charId).color
    if (pendingOrder()) {
      const incoming = new Map(next.map((row) => [row.charId, row]))
      next = [
        ...participants.value
          .map((row) => incoming.get(row.charId))
          .filter(Boolean),
        ...next.filter((row) => !local.has(row.charId)),
      ]
    }
    const current = participants.value
    const result = applyDocumentPatches(current, documentDiff(current, next))
    if (current !== result) participants.value = result
  }
}
