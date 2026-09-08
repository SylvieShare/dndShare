export const JOURNAL_NODE_WIDTH = 300
export const JOURNAL_NODE_HEIGHT = 148
export const journalLinkId = link => `${link.fromId}:${link.toId}`

export function journalEntries(journal) {
  return (journal?.sections || []).flatMap(section => section.events.map(event => ({
    ...event, sectionId: section.id, sectionTitle: section.title || 'Без названия',
  })))
}

export function journalSectionGraph(journal, sectionId, positions = {}) {
  const entries = journalEntries(journal)
  const sectionsById = new Map(entries.map(event => [event.id, event.sectionId]))
  const externalCounts = new Map()
  for (const link of journal.graph?.links || []) {
    if (sectionsById.get(link.fromId) === sectionsById.get(link.toId)) continue
    for (const id of [link.fromId, link.toId]) externalCounts.set(id, (externalCounts.get(id) || 0) + 1)
  }
  const coordinates = new Map((journal.graph?.nodes || []).map(node => [String(node.id), node]))
  const nodes = entries.filter(event => event.sectionId === sectionId).map(event => ({
    ...event, ...coordinates.get(event.id), ...positions[event.id],
    externalLinks: externalCounts.get(event.id) || 0,
  }))
  const ids = new Set(nodes.map(node => node.id))
  const edges = (journal.graph?.links || []).filter(link => ids.has(link.fromId) && ids.has(link.toId))
    .map(link => ({ ...link, id: journalLinkId(link) }))
  return { nodes, edges }
}

export function canConnectJournal(links, fromId, toId) {
  if (!fromId || !toId || fromId === toId || links.some(link => link.fromId === fromId && link.toId === toId)) return false
  const next = new Map()
  for (const link of links) next.set(link.fromId, [...(next.get(link.fromId) || []), link.toId])
  const queue = [toId], visited = new Set()
  while (queue.length) {
    const id = queue.pop()
    if (id === fromId) return false
    if (visited.has(id)) continue
    visited.add(id)
    queue.push(...(next.get(id) || []))
  }
  return true
}

export function journalEntryConnections(journal, id) {
  const entries = new Map(journalEntries(journal).map(entry => [entry.id, entry]))
  return (journal.graph?.links || []).filter(link => link.fromId === id || link.toId === id).map(link => ({
    ...link, id: journalLinkId(link), incoming: link.toId === id,
    event: entries.get(link.fromId === id ? link.toId : link.fromId),
  })).filter(link => link.event)
}
