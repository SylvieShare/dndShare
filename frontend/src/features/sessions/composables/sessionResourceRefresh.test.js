import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSessionMaterials } from './useSessionMaterials'
import { useSessionWorld } from './useSessionWorld'

const api = vi.hoisted(() => ({
  getSessionMaterials: vi.fn(),
  getSessionWorld: vi.fn(),
}))

vi.mock('@/shared/api/sessionsApi', () => ({
  createSessionLocation: vi.fn(),
  createSessionMaterial: vi.fn(),
  createSessionNpc: vi.fn(),
  createSessionQuest: vi.fn(),
  deleteSessionLocation: vi.fn(),
  deleteSessionMaterial: vi.fn(),
  deleteSessionNpc: vi.fn(),
  deleteSessionQuest: vi.fn(),
  getSessionMaterials: api.getSessionMaterials,
  getSessionWorld: api.getSessionWorld,
  moveSessionLocation: vi.fn(),
  updateSessionLocation: vi.fn(),
  updateSessionMaterial: vi.fn(),
  updateSessionNpc: vi.fn(),
  updateSessionQuest: vi.fn(),
}))

function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

describe('session resource forced refresh', () => {
  beforeEach(() => vi.clearAllMocks())

  it('starts a new world request when a forced refresh meets an older in-flight request', async () => {
    const stale = deferred()
    const current = {
      locations: [],
      npcs: [],
      scenes: [{ id: 7 }],
      quests: [{ id: 2, scenarioUsages: [{ sceneId: 7, blockCount: 1 }] }],
    }
    api.getSessionWorld.mockReturnValueOnce(stale.promise).mockResolvedValueOnce(current)
    const world = useSessionWorld('session-uuid')

    const initialLoad = world.load()
    const forcedLoad = world.load(true)
    stale.resolve({ locations: [], npcs: [], quests: [], scenes: [] })
    await Promise.all([initialLoad, forcedLoad])

    expect(api.getSessionWorld).toHaveBeenCalledTimes(2)
    expect(world.quests.value[0].scenarioUsages).toEqual([{ sceneId: 7, blockCount: 1 }])
  })

  it('starts a new materials request when usage refresh meets an in-flight request', async () => {
    const stale = deferred()
    const current = { materials: [{ id: 4, scenarioUsages: [{ sceneId: 7, blockCount: 1 }] }] }
    api.getSessionMaterials.mockReturnValueOnce(stale.promise).mockResolvedValueOnce(current)
    const materials = useSessionMaterials({ sessionUuid: 'session-uuid' })

    const initialLoad = materials.load()
    const forcedLoad = materials.load(true)
    stale.resolve({ materials: [] })
    await Promise.all([initialLoad, forcedLoad])

    expect(api.getSessionMaterials).toHaveBeenCalledTimes(2)
    expect(materials.materials.value[0].scenarioUsages).toEqual([{ sceneId: 7, blockCount: 1 }])
  })
})
