import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { useSessionParticipantRail } from './useSessionParticipantRail'
import { useSessionSelection } from './useSessionSelection'
import { sessionWorkspaceKey, useSessionWorkspace } from './useSessionWorkspace'
import { kickParticipant } from '@/shared/api/sessionsApi'
import { getSceneGraph } from '@/shared/api/scenesApi'

vi.mock('vue', async original => ({ ...(await original()), onBeforeUnmount: vi.fn() }))
vi.mock('@/shared/api/sessionsApi', () => ({ kickParticipant: vi.fn() }))
vi.mock('@/shared/api/scenesApi', () => ({ getSceneGraph: vi.fn() }))
let storage, scope
beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  storage = new Map()
  vi.stubGlobal('localStorage', { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) })
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
  scope = effectScope()
})
afterEach(() => { scope.stop(); vi.unstubAllGlobals(); vi.useRealTimers() })
const chapter = { id: 12, arcId: 3, name: 'Перевал' }
function workspace(uuid = 'session') {
  const graph = { loaded: ref(true), chapters: ref([chapter]), selectArc: vi.fn(), focusCurrent: () => chapter }
  return { ...scope.run(() => useSessionWorkspace({ sessionUuid: uuid, chapterGraph: graph })), graph }
}

it('preserves the rail preference across combat and keeps different sessions independent', async () => {
  const mode = ref(null)
  const rail = scope.run(() => useSessionParticipantRail({ sessionUuid: 'one', workspaceMotionMode: mode }))
  expect(rail.mode.value).toBe('normal')
  rail.toggle()
  await nextTick()
  expect(rail.mode.value).toBe('compact')
  mode.value = 'combat'
  rail.toggle()
  expect(rail.mode.value).toBe('combat')
  mode.value = null
  expect(rail.mode.value).toBe('compact')
  expect(scope.run(() => useSessionParticipantRail({ sessionUuid: 'one', workspaceMotionMode: mode })).mode.value).toBe('compact')
  expect(scope.run(() => useSessionParticipantRail({ sessionUuid: 'two', workspaceMotionMode: mode })).mode.value).toBe('normal')
})

it('removes a participant only after the server responds and deduplicates an in-flight kick', async () => {
  let release
  kickParticipant.mockImplementation(() => new Promise(resolve => { release = resolve }))
  const participants = ref([{ charId: 1 }, { charId: 2 }])
  const selection = useSessionSelection({ sessionUuid: 'session', participants })
  const request = selection.kickParticipant(1)
  expect(participants.value).toHaveLength(2)
  expect(selection.kickingIds.value.has(1)).toBe(true)
  expect(await selection.kickParticipant(1)).toBe(false)
  expect(kickParticipant).toHaveBeenCalledExactlyOnceWith('session', 1)
  release()
  expect(await request).toBe(true)
  expect(participants.value).toEqual([{ charId: 2 }])
  expect(selection.kickingIds.value.size).toBe(0)
})

it('keeps the participant and exposes a retryable error after a failed kick', async () => {
  kickParticipant.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined)
  const participants = ref([{ charId: 1 }])
  const selection = useSessionSelection({ sessionUuid: 'session', participants })
  expect(await selection.kickParticipant(1)).toBe(false)
  expect(participants.value).toHaveLength(1)
  expect(selection.kickError.value).toBeTruthy()
  expect(await selection.kickParticipant(1)).toBe(true)
  expect(participants.value).toEqual([])
  expect(selection.kickError.value).toBe('')
})

it('restores combat with its chapter and nested scene after a reload', async () => {
  const first = workspace()
  await first.toggleCombatWorkspace({ chapter, scene: { id: 31, name: 'Встреча' }, level: 'blocks' })
  await vi.runAllTimersAsync()
  getSceneGraph.mockResolvedValue({ scenes: [{ id: 31, name: 'Встреча' }] })
  const restored = workspace()
  expect(await restored.restoreWorkspace()).toBe(true)
  expect(restored.workspaceMode.value).toBe('combat')
  expect(restored.workspaceLevel.value).toBe('blocks')
  expect(restored.workspaceScene.value.id).toBe(31)
  expect(restored.graph.selectArc).toHaveBeenCalledWith(3)
})

it('returns from combat to the nested scene and can explicitly return to chapters', async () => {
  const state = workspace()
  await state.toggleCombatWorkspace({ chapter, scene: { id: 31 }, level: 'blocks' })
  await vi.runAllTimersAsync()
  state.closeWorkspace()
  expect(state.workspaceClosing.value).toBe(true)
  await vi.runAllTimersAsync()
  expect(state.workspaceMode.value).toBe('scenes')
  expect(state.workspaceScene.value.id).toBe(31)
  state.openChapters()
  await vi.runAllTimersAsync()
  expect(state.workspaceMode.value).toBeNull()
  expect(storage.has(sessionWorkspaceKey('session'))).toBe(false)
})

it('does not reopen a deleted chapter or a scene missing from the server', async () => {
  storage.set(sessionWorkspaceKey('session'), JSON.stringify({ mode: 'scenes', chapterId: 999 }))
  const state = workspace()
  expect(await state.restoreWorkspace()).toBe(false)
  expect(storage.has(sessionWorkspaceKey('session'))).toBe(false)
  getSceneGraph.mockResolvedValue({ scenes: [] })
  expect(await state.openSceneWorkspace({ chapterId: chapter.id, id: 999 })).toBe(false)
  expect(state.workspaceMode.value).toBeNull()
})
