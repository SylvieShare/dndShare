import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive, ref } from 'vue'
import { useJournalGraphEditor } from './useJournalGraphEditor'
vi.mock('vue', async original => ({ ...await original(), onBeforeUnmount: vi.fn() }))
vi.mock('./useJournalLayout', () => ({ useJournalLayout: () => ({ arranging: ref(false), arrange: vi.fn().mockResolvedValue([]) }) }))
const scopes = []
afterEach(() => scopes.splice(0).forEach(scope => scope.stop()))
function setup() {
  const props = reactive({ editable: true, busy: false, sectionId: 's', journal: {
    sections: [{ id: 's', events: [{ id: '1', title: 'Начало' }, { id: '2', title: 'Продолжение' }] }],
    graph: { revision: 7, nodes: [{ id: '1', positionX: 0, positionY: 0 }, { id: '2', positionX: 0, positionY: -200 }], links: [{ fromId: '1', toId: '2', label: '' }] },
  }, updateGraph: vi.fn().mockResolvedValue({}), createEntry: vi.fn().mockResolvedValue({}), removeEntry: vi.fn().mockResolvedValue({}) })
  const emit = vi.fn(), canvas = ref({ focusNode: vi.fn(), fitContent: vi.fn() }), scope = effectScope()
  scopes.push(scope)
  return { props, emit, ...scope.run(() => useJournalGraphEditor(props, emit, canvas)) }
}
describe('journal graph editing lifecycle', () => {
  it('keeps a drag version and does not rewrite graph links when moving', async () => {
    const state = setup()
    state.setInteraction(true)
    state.preview([{ id: '1', x: 123, y: 456 }])
    expect(state.graph.value.nodes[0].positionX).toBe(123)
    state.props.journal.graph.revision = 8
    await state.savePositions([{ id: '1', x: 123, y: 456 }])
    expect(state.props.updateGraph).toHaveBeenCalledWith({ expectedRevision: 7, positions: [{ id: 1, positionX: 123, positionY: 456 }] })
    expect(state.props.journal.graph.nodes[0].positionX).toBe(0)
  })
  it('blocks navigation and graph changes while an inline draft is open', async () => {
    const state = setup()
    await state.select(state.entries.value[0])
    state.setEditing('1', true)
    await state.select(state.entries.value[1])
    await state.unlink(state.props.journal.graph.links[0])
    await state.create('battle')
    expect(state.selectedId.value).toBe('1')
    expect(state.props.updateGraph).not.toHaveBeenCalled()
    expect(state.props.createEntry).not.toHaveBeenCalled()
  })
  it('uses the selected event as the parent of a continuation', async () => {
    const state = setup()
    await state.select(state.entries.value[0])
    await state.create('dialog')
    expect(state.props.createEntry).toHaveBeenCalledWith('s', expect.objectContaining({ type: 'dialog' }), { parentIds: [1] })
  })
  it('rejects cycles locally and remains read-only after permission changes', async () => {
    const state = setup()
    await state.connect('2', '1')
    expect(state.props.updateGraph).not.toHaveBeenCalled()
    expect(state.error.value).toContain('предыдущую')
    state.startLink(state.entries.value[0])
    state.props.editable = false
    await nextTick()
    expect(state.linkingFrom.value).toBeNull()
    await state.unlink(state.props.journal.graph.links[0])
    expect(state.props.updateGraph).not.toHaveBeenCalled()
  })
  it('rolls back a rejected move preview', async () => {
    const state = setup()
    state.props.updateGraph.mockRejectedValue(new Error('Конфликт'))
    state.setInteraction(true)
    state.preview([{ id: '1', x: 999, y: 10 }])
    await state.savePositions([{ id: '1', x: 999, y: 10 }])
    expect(state.graph.value.nodes[0].positionX).toBe(0)
    expect(state.error.value).toBe('Конфликт')
  })
})
