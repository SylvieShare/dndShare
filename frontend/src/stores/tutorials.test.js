import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { fetchGet, fetchPut, fetchPost } from '@/shared/api/http'
import { useAccountStore } from './account'
import { useTutorialsStore } from './tutorials'
vi.mock('@/shared/api/http', () => ({ fetchGet: vi.fn(), fetchPut: vi.fn(), fetchPost: vi.fn() }))
const entry = { flowId: 'character', sourceKey: 'edition:1', device: 'mobile', revision: 1 }
beforeEach(() => {
  setActivePinia(createPinia()); vi.resetAllMocks()
  const account = useAccountStore(); account.status = 'success'; account.user.id = 1
  fetchGet.mockResolvedValue({ tutorials: [] })
})
describe('tutorial account preferences', () => {
  it('deduplicates loads and saves only the requested identity', async () => {
    const store = useTutorialsStore()
    await Promise.all([store.ensure(), store.ensure()])
    expect(fetchGet).toHaveBeenCalledTimes(1)
    await store.save(entry, 'completed')
    await store.save({ ...entry, device: 'desktop' }, 'dismissed')
    expect(store.entries).toHaveLength(2)
    await store.reset(entry)
    expect(store.entries).toEqual([{ ...entry, device: 'desktop', status: 'dismissed' }])
    expect(fetchPost).toHaveBeenCalledWith('/account/tutorials/reset', { flowId: entry.flowId, sourceKey: entry.sourceKey, device: entry.device })
  })
  it('does not fabricate progress after failed persistence and retries a failed load', async () => {
    const store = useTutorialsStore()
    fetchGet.mockRejectedValueOnce(new Error('offline'))
    await expect(store.ensure()).rejects.toThrow('offline')
    await store.ensure()
    fetchPut.mockRejectedValueOnce(new Error('offline'))
    await expect(store.save(entry, 'completed')).rejects.toThrow('offline')
    expect(store.entries).toEqual([])
  })
  it('preserves completed progress when a replay is skipped or an old tab finishes', async () => {
    const store = useTutorialsStore(); await store.ensure()
    await store.save({ ...entry, revision: 2 }, 'completed')
    await store.save({ ...entry, revision: 2 }, 'dismissed')
    await store.save(entry, 'completed')
    expect(store.entries).toEqual([{ ...entry, revision: 2, status: 'completed' }])
  })
  it('clears progress when a different user signs in' , async () => {
    const store = useTutorialsStore(); await store.ensure(); await store.save(entry, 'completed')
    useAccountStore().user.id = 2
    await store.ensure()
    expect(store.entries).toEqual([])
  })
})
