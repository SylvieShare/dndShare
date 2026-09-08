import { describe, expect, it } from 'vitest'
import { canConnectJournal, journalEntryConnections, journalSectionGraph } from './journalGraph'

const links = [{ fromId: '1', toId: '2' }, { fromId: '1', toId: '3' }, { fromId: '2', toId: '4' }, { fromId: '3', toId: '4' }]
const journal = {
  sections: [{ id: 'a', title: 'Разделение', events: [{ id: '1' }, { id: '2' }, { id: '3' }] }, { id: 'b', title: 'Встреча', events: [{ id: '4' }] }],
  graph: { nodes: ['1', '2', '3', '4'].map(id => ({ id, positionX: 0, positionY: -200 * Number(id) })), links },
}
describe('journal topology', () => {
  it('allows repeated branching and merging, rejects cycles and duplicates', () => {
    expect(canConnectJournal(links, '4', '5')).toBe(true)
    expect(canConnectJournal(links, '2', '3')).toBe(true)
    expect(canConnectJournal(links, '4', '1')).toBe(false)
    expect(canConnectJournal(links, '4', '3')).toBe(false)
    expect(canConnectJournal(links, '1', '2')).toBe(false)
    expect(canConnectJournal(links, '2', '2')).toBe(false)
  })
  it('keeps external links discoverable while drawing only the current section', () => {
    const graph = journalSectionGraph(journal, 'a', { 2: { positionX: 350, positionY: -100 } })
    expect(graph.nodes).toHaveLength(3)
    expect(graph.edges).toHaveLength(2)
    expect(graph.nodes[1]).toMatchObject({ id: '2', positionX: 350, externalLinks: 1 })
    expect(journal.graph.nodes[1].positionX).toBe(0)
    const connections = journalEntryConnections(journal, '4')
    expect(connections).toHaveLength(2)
    expect(connections.every(link => link.incoming && link.event.sectionId === 'a')).toBe(true)
  })
})
