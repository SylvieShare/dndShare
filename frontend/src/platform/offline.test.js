import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const harness = vi.hoisted(() => ({ database: null, journal: { flush: async () => {} } }))
vi.mock('./storage', () => ({ isAndroid: false, nativeStore: {}, openLocalDatabase: async () => harness.database }))
vi.mock('./journal', () => ({ prepareLocalJournal: async () => {}, outboxStorage: () => harness.journal }))
vi.mock('./handbook', () => ({ invalidateLocalHandbook() {}, localHandbookResponse: async () => null, saveCatalogueMutation: async () => {}, syncHandbook: async () => {} }))
vi.mock('./snapshots', () => ({ updateConfirmedSnapshot: async () => {} }))
vi.mock('./recoverQueues', () => ({ resumeLocalQueues: async () => [] }))
vi.mock('./updates', () => ({ trackMutation() {} }))

let offline, problems, transport, mode
beforeEach(async () => {
  vi.resetModules()
  vi.useFakeTimers()
  const records = new Map([['identity', { payload: { auth: true, user: { id: 1 } }, expiresAt: Date.now() + 100000000 }]])
  harness.database = {
    get: async key => records.get(key),
    batch: async changes => { for (const { key, value } of changes) records.set(key, value) },
    clear: async prefix => { for (const key of records.keys()) if (key.startsWith(prefix)) records.delete(key) },
  }
  mode = 200
  transport = vi.fn(async input => {
    const path = new URL(typeof input === 'string' ? input : input.url, 'https://test.local').pathname
    if (path === '/api/chars') {
      if (mode === 'network') throw new TypeError('Failed to fetch')
      if (mode === 'timeout') throw new DOMException('deadline', 'TimeoutError')
      return Response.json({ chars: [] }, { status: mode })
    }
    return Response.json(path === '/api/sources' ? { sources: [] } : {})
  })
  const browser = new EventTarget()
  browser.fetch = transport
  vi.stubGlobal('window', browser)
  vi.stubGlobal('document', Object.assign(new EventTarget(), { visibilityState: 'visible', createElement: () => ({}) }))
  vi.stubGlobal('location', { href: 'https://test.local/char/test', origin: 'https://test.local', reload() {} })
  vi.stubGlobal('localStorage', { clear() {} })
  offline = await import('./offline')
  problems = await import('./localSyncProblems')
  await offline.initializeLocalPlatform()
})
afterEach(async () => {
  await offline?.clearLocalAccount()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
const characterRequests = () => transport.mock.calls.filter(([input]) => String(input).includes('/api/chars')).length

it.each(['network', 'timeout', 408, 504])('keeps background retries running without a popup after %s', async failure => {
  mode = failure
  await offline.synchronizeLocalData()
  await vi.advanceTimersByTimeAsync(900000)
  expect(characterRequests()).toBe(4)
  expect(problems.localSyncProblems.event).toBeNull()
  expect(offline.localState.syncing).toBe(false)
})
it('reports a server outage once across retries and allows a new incident after recovery', async () => {
  mode = 500
  await offline.synchronizeLocalData()
  const first = problems.localSyncProblems.event.id
  await vi.advanceTimersByTimeAsync(600000)
  expect(characterRequests()).toBe(3)
  expect(problems.localSyncProblems.event.id).toBe(first)
  mode = 200
  await vi.advanceTimersByTimeAsync(300000)
  expect(problems.localSyncProblems.event).toBeNull()
  mode = 503
  await offline.synchronizeLocalData()
  expect(problems.localSyncProblems.event.id).toBeGreaterThan(first)
  expect(problems.localSyncProblems.event.message).toContain('503')
})
it('reports API incompatibility and releases all scheduled work on logout', async () => {
  mode = 426
  await offline.synchronizeLocalData()
  expect(problems.localSyncProblems.event.group).toBe('version')
  const count = characterRequests()
  await offline.clearLocalAccount()
  await vi.advanceTimersByTimeAsync(900000)
  expect(characterRequests()).toBe(count)
  expect(problems.localSyncProblems.event).toBeNull()
})
it.each([{ path: '/api/late', cached: false }, { path: '/api/late', cached: true }, { path: '/api/user/checkAuth', cached: true }])('does not restore account data when $path (cached: $cached) arrives after logout', async ({ path, cached }) => {
  const key = `account:1:http:${path}`
  if (cached) await harness.database.batch([{ key, value: { payload: { old: true } } }])
  let release, started
  const reading = new Promise(resolve => { started = resolve })
  const json = () => { started(); return new Promise(resolve => { release = resolve }) }
  transport.mockImplementationOnce(async () => ({ ok: true, status: 200, headers: new Headers({ 'Content-Type': 'application/json' }), json, clone: () => ({ json }) }))
  const pending = window.fetch(path)
  await reading
  await offline.clearLocalAccount()
  release({ auth: true, user: { id: 1 }, late: true })
  await pending
  await vi.advanceTimersByTimeAsync(0)
  expect(await harness.database.get(key)).toBeUndefined()
  expect(await harness.database.get('identity')).toBeNull()
  expect(offline.localState.accountId).toBeNull()
})
