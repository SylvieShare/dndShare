import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { fetchGet, fetchPut } from '@/shared/api/http'
import { useAccountStore } from '@/stores/account'
import { useGameContextStore } from '@/stores/gameContext'

vi.mock('@/shared/api/http', () => ({
  fetchGet: vi.fn(),
  fetchPut: vi.fn(),
  fetchPost: vi.fn(),
  fetchGetEmpty: vi.fn(),
}))

const sources = [
  { id: 1, name: 'DND5e', versions: [{ id: 11, sourceId: 1, version: '2014' }, { id: 12, sourceId: 1, version: '2024' }] },
  { id: 2, name: 'Vampire: TM', versions: [{ id: 22, sourceId: 2, version: 'V20' }] },
]

describe('player game context store', () => {
  let storage

  beforeEach(() => {
    setActivePinia(createPinia())
    storage = new Map()
    vi.stubGlobal('localStorage', {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key),
    })
    vi.clearAllMocks()
    fetchGet.mockResolvedValue({ sources })
  })

  it('uses D&D 5e 2014 by default and persists a guest selection locally', async () => {
    const account = useAccountStore()
    account.status = 'none'
    const store = useGameContextStore()

    await store.ensure()
    expect(store.context).toEqual(expect.objectContaining({ sourceName: 'DND5e', version: '2014' }))

    await store.selectVersion(22)
    expect(store.rulesPath).toBe('/rules/vampire-tm/v20')
    expect(storage.get('dndshare.gameContext.sourceVersionId')).toBe('22')
  })

  it('uses the authenticated database preference and saves changes through account API', async () => {
    const account = useAccountStore()
    account.status = 'success'
    account.user = {
      id: 7,
      login: 'lyra',
      roles: [],
      gameContext: { sourceId: 2, sourceName: 'Vampire: TM', sourceVersionId: 22, version: 'V20' },
    }
    fetchPut.mockResolvedValue({
      gameContext: { sourceId: 1, sourceName: 'DND5e', sourceVersionId: 11, version: '2014' },
    })
    const store = useGameContextStore()

    await store.ensure()
    expect(store.sourceVersionId).toBe(22)
    await store.selectVersion(11)

    expect(fetchPut).toHaveBeenCalledWith('/account/game-context', { sourceVersionId: 11 })
    expect(account.user.gameContext.sourceVersionId).toBe(11)
  })

  it('switches directly to an edition of another system with a single save', async () => {
    const account = useAccountStore()
    account.status = 'success'
    account.user = { id: 7, roles: [], gameContext: { sourceVersionId: 22 } }
    fetchPut.mockResolvedValue({ gameContext: { sourceVersionId: 12 } })
    const store = useGameContextStore()
    await store.ensure()

    await store.selectVersion(12)

    expect(fetchPut).toHaveBeenCalledTimes(1)
    expect(fetchPut).toHaveBeenCalledWith('/account/game-context', { sourceVersionId: 12 })
    expect(store.rulesPath).toBe('/rules/dnd5e/2024')
  })

  it('restores the complete previous choice if saving the new edition fails', async () => {
    const account = useAccountStore()
    account.status = 'success'
    account.user = { id: 7, roles: [], gameContext: { sourceVersionId: 22 } }
    fetchPut.mockRejectedValue(new Error('offline'))
    const store = useGameContextStore()
    await store.ensure()

    await expect(store.selectVersion(12)).rejects.toThrow('offline')

    expect(store.rulesPath).toBe('/rules/vampire-tm/v20')
    expect(store.sourceVersionId).toBe(22)
    expect(store.error).toBe('Не удалось сохранить выбор')
    expect(store.saving).toBe(false)
  })
})
