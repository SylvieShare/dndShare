import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { getSessions } from '@/shared/api/sessionsApi'
import { useActiveSessionsStore } from './activeSessions'
vi.mock('@/shared/api/sessionsApi', () => ({ getSessions: vi.fn() }))
const session = (uuid, status = 'active', ownerUserId = 1) => ({ uuid, status, ownerUserId, name: uuid })
beforeEach(() => { setActivePinia(createPinia()); vi.resetAllMocks() })
describe('active session shortcuts', () => {
  it('loads only active owned sessions and avoids refetching on each route', async () => {
    const store = useActiveSessionsStore()
    getSessions.mockResolvedValue({ sessions: [
      { myRole: 'gm', session: session('mine') },
      { myRole: 'gm', session: session('stopped', 'stopped') },
      { myRole: 'gm', session: session('completed', 'completed') },
      { myRole: 'player', session: session('other', 'active', 2) },
    ] })
    store.setUser(1)
    await store.refresh()
    await store.refresh()
    expect(store.sessions.map(entry => entry.uuid)).toEqual(['mine'])
    expect(getSessions).toHaveBeenCalledTimes(1)
    store.remember(session('mine', 'stopped'))
    expect(store.sessions).toEqual([])
    store.remember(session('second'))
    expect(store.sessions.map(entry => entry.uuid)).toEqual(['second'])
  })
  it('does not restore a stopped session from an older in-flight response', async () => {
    let resolve
    getSessions.mockImplementation(() => new Promise(done => { resolve = done }))
    const store = useActiveSessionsStore()
    store.setUser(1)
    const loading = store.refresh()
    store.remember(session('mine', 'stopped'))
    resolve({ sessions: [{ myRole: 'gm', session: session('mine') }, { myRole: 'gm', session: session('second') }] })
    await loading
    expect(store.sessions.map(entry => entry.uuid)).toEqual(['second'])
  })
  it('clears shortcuts on logout and discards the prior account request', async () => {
    let resolve
    getSessions.mockImplementation(() => new Promise(done => { resolve = done }))
    const store = useActiveSessionsStore()
    store.setUser(1)
    store.remember(session('mine'))
    const loading = store.refresh()
    store.setUser(null)
    resolve({ sessions: [{ myRole: 'gm', session: session('mine') }] })
    await loading
    expect(store.sessions).toEqual([])
    await store.refresh()
    expect(getSessions).toHaveBeenCalledTimes(1)
  })
})
