import { applyDocumentPatches, copyDocument, rebaseDocumentChanges, sameDocument } from './documentPatch'

function replay(base, groups) {
  let data = copyDocument(base)
  for (const group of groups) data = applyDocumentPatches(data, group.patches)
  return data
}

function transfer(previous, next, groups, canonicalize) {
  const retained = []
  for (const group of groups) {
    const result = rebaseDocumentChanges(previous, next, group.patches, canonicalize)
    previous = applyDocumentPatches(previous, group.patches)
    next = result.data
    if (result.patches.length || group.metadata.events?.length) retained.push({ ...group, patches: result.patches })
  }
  return { data: next, groups: retained }
}

export function recoverDocumentQueue(saved, current, currentVersion, local, canonicalize) {
  if (!Array.isArray(saved.queue) || !Number.isInteger(saved.version)) throw new Error('Некорректная сохранённая очередь')
  let base = saved.base, version = saved.version, queue = saved.queue
  const flight = saved.flight || null
  let data = replay(base, [...(flight ? [{ patches: flight.packet.patches }] : []), ...queue])
  if (!flight && (currentVersion !== version || !sameDocument(current, base))) {
    const result = transfer(copyDocument(base), copyDocument(current), queue, canonicalize)
    base = current
    version = currentVersion
    queue = result.groups
    data = result.data
  }
  const added = transfer(copyDocument(current), data, local, canonicalize)
  return {
    base, version, queue: [...queue, ...added.groups], flight, data: added.data,
    deferred: flight && currentVersion > version ? { data: current, version: currentVersion } : null,
  }
}
