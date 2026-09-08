import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { useJournalLayout } from './useJournalLayout'

const mocks = vi.hoisted(() => ({ layout: vi.fn(), terminate: vi.fn(), cleanup: null, worker: null }))
vi.mock('vue', async original => ({ ...await original(), onBeforeUnmount: callback => { mocks.cleanup = callback } }))
vi.mock('elkjs/lib/elk-worker.min.js?url', () => ({ default: '/static/elk-worker.js' }))
vi.mock('elkjs/lib/elk-api.js', () => ({ default: class {
  constructor({ workerFactory }) { workerFactory() }
  layout = mocks.layout
  terminateWorker = mocks.terminate
} }))
const nodes = [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }]
const edges = [
  { id: '1:2', fromId: '1', toId: '2' }, { id: '1:3', fromId: '1', toId: '3' },
  { id: '2:4', fromId: '2', toId: '4' }, { id: '3:4', fromId: '3', toId: '4' },
]
beforeEach(() => {
  vi.clearAllMocks()
  mocks.worker = null
  mocks.layout.mockResolvedValue({ children: nodes.map((node, index) => ({ ...node, x: index * 360, y: -index * 212 })) })
  vi.stubGlobal('Worker', class { constructor(url) { this.url = url; mocks.worker = this } })
})
afterEach(() => { mocks.cleanup?.(); vi.unstubAllGlobals(); vi.useRealTimers() })

describe('journal explicit Worker layout', () => {
  it('loads on demand and passes the whole branch/merge topology upwards', async () => {
    const state = useJournalLayout()
    expect(mocks.worker).toBeNull()
    const result = await state.arrange(nodes, edges)
    expect(mocks.worker.url).toBe('/static/elk-worker.js')
    expect(mocks.layout).toHaveBeenCalledWith(expect.objectContaining({
      layoutOptions: expect.objectContaining({ 'elk.direction': 'UP', 'elk.algorithm': 'layered' }),
      edges: expect.arrayContaining([{ id: '3:4', sources: ['3'], targets: ['4'] }]),
    }))
    expect(result[1]).toEqual({ id: 2, positionX: 360, positionY: -212 })
    expect(state.arranging.value).toBe(false)
  })
  it('unlocks the workspace on Worker loading errors and permits a retry', async () => {
    mocks.layout.mockImplementationOnce(() => new Promise(() => {}))
    const state = useJournalLayout()
    const pending = state.arrange(nodes, edges)
    const failed = expect(pending).rejects.toThrow('Не удалось загрузить')
    await vi.waitFor(() => expect(mocks.worker).not.toBeNull())
    mocks.worker.onerror()
    await failed
    expect(state.arranging.value).toBe(false)
    expect(mocks.terminate).toHaveBeenCalledOnce()
    await expect(state.arrange(nodes, edges)).resolves.toHaveLength(4)
  })
  it('terminates pending work when the journal is unmounted', async () => {
    mocks.layout.mockImplementationOnce(() => new Promise(() => {}))
    const state = useJournalLayout()
    const pending = state.arrange(nodes, edges)
    await vi.waitFor(() => expect(mocks.worker).not.toBeNull())
    mocks.cleanup()
    await expect(pending).resolves.toBeNull()
    await nextTick()
    expect(state.arranging.value).toBe(false)
  })
})
