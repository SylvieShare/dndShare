import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref, shallowReactive } from 'vue'
import { useSessionGraphNavigation } from './useSessionGraphNavigation'

vi.mock('vue', async original => ({ ...(await original()), onBeforeUnmount: vi.fn() }))
vi.mock('@/features/items/composables/useItemReferenceMap', () => ({ useItemReferenceMap: () => ({ itemsById: ref(new Map()) }) }))
vi.mock('@/features/sessions/composables/useSceneGraph', () => ({ useSceneGraph: () => {
  const scenes = ref([]), loaded = ref(false)
  return { scenes, loaded, reset: vi.fn(() => { scenes.value = []; loaded.value = false }), load: vi.fn(async () => { scenes.value = [{ id: 31, chapterId: 12, name: 'Встреча' }]; loaded.value = true }) }
} }))
vi.mock('@/features/sessions/composables/useSceneBlockGraph', () => ({ useSceneBlockGraph: () => ({ items: ref([]), reset: vi.fn(), load: vi.fn(async () => {}) }) }))
let scope
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); scope = effectScope()
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
  vi.stubGlobal('requestAnimationFrame', callback => setTimeout(callback, 0))
})
afterEach(() => { scope.stop(); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals() })
function navigation(overrides = {}) {
  const props = shallowReactive({ sessionUuid: 'session', graph: { chapters: ref([{ id: 12, name: 'Перевал' }]), selectedArc: ref({ id: 3 }) }, workspaceMode: null, workspaceChapterId: 12, workspaceLevel: 'scenes', workspaceScene: null, ...overrides })
  const emit = vi.fn(), canvas = ref({ prepareView: vi.fn() })
  return { ...scope.run(() => useSessionGraphNavigation({ props, emit, canvas })), props, emit, canvas }
}
async function settle() { await nextTick(); await vi.runAllTimersAsync(); await nextTick() }

it('opens chapters, scenes and blocks with distinct canvas identities and loads their data', async () => {
  const graph = navigation()
  expect(graph.graphKeyFor('chapters')).toBe('chapters:session:3')
  graph.props.workspaceMode = 'scenes'
  await settle()
  expect(graph.displayLevel.value).toBe('scenes')
  expect(graph.sceneGraph.scenes.value[0].name).toBe('Встреча')
  expect(graph.emit).toHaveBeenCalledWith('scene-count', 12, 1)
  graph.openBlocksLevel(graph.sceneGraph.scenes.value[0])
  await settle()
  expect(graph.displayLevel.value).toBe('blocks')
  expect(graph.selectedScene.value.id).toBe(31)
  expect(graph.blockGraph.load).toHaveBeenCalledOnce()
  expect(graph.canvas.value.prepareView.mock.calls.map(call => call[0])).toEqual(['scenes:session:12', 'blocks:session:31'])
})

it('restores a selected nested scene without briefly reusing chapter nodes', async () => {
  const graph = navigation({ workspaceMode: 'scenes', workspaceLevel: 'blocks', workspaceScene: { id: 31 } })
  await settle()
  expect(graph.displayLevel.value).toBe('blocks')
  expect(graph.selectedScene.value.name).toBe('Встреча')
  expect(graph.canvas.value.prepareView.mock.calls.map(call => call[0])).toEqual(['blocks:session:31'])
  expect(graph.combatSceneContext()).toMatchObject({ id: 31, contextIndex: 0 })
})

it('preserves scene data and camera context when returning from combat', async () => {
  const graph = navigation({ workspaceMode: 'scenes', workspaceLevel: 'blocks', workspaceScene: { id: 31 } })
  await settle()
  const scenes = graph.sceneGraph.scenes.value
  graph.props.workspaceMode = 'combat'
  await settle()
  expect(graph.selectedScene.value.id).toBe(31)
  graph.props.workspaceMode = 'scenes'
  await settle()
  expect(graph.displayLevel.value).toBe('blocks')
  expect(graph.sceneGraph.scenes.value).toBe(scenes)
  expect(graph.sceneGraph.load).toHaveBeenCalledOnce()
})

it('uses contextual navigation during combat and clears obsolete nested selection on exit', async () => {
  const graph = navigation({ workspaceMode: 'scenes', workspaceLevel: 'blocks', workspaceScene: { id: 31 } })
  await settle()
  graph.props.workspaceMode = 'combat'
  await settle()
  graph.returnToScenes()
  expect(graph.emit).toHaveBeenCalledWith('open-scenes', graph.activeChapter.value)
  graph.returnToChapters()
  expect(graph.emit).toHaveBeenCalledWith('open-chapters')
  graph.props.workspaceMode = null
  await settle()
  expect(graph.displayLevel.value).toBe('chapters')
  expect(graph.selectedScene.value).toBeNull()
})
