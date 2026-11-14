import { reactive } from 'vue'
import { isAndroid, nativeStore, openLocalDatabase } from './storage'
import { prepareLocalJournal, outboxStorage } from './journal'
import { invalidateLocalHandbook, localHandbookResponse, saveCatalogueMutation, syncHandbook } from './handbook'
import { updateConfirmedSnapshot } from './snapshots'
import { resumeLocalQueues } from './recoverQueues'
import { apiHeaders } from './build'
import { trackMutation } from './updates'
import { reportSyncProblem, resolveSyncProblem, resetSyncProblems, reportRecoveredSyncProblems } from './localSyncProblems'

export const localState = reactive({ online: true, syncing: false, accountId: null, ready: false })
let database, network, controller, scope = 'public:', refreshTimer, bootPromise
let accountEpoch = 0
const json = value => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json', 'X-DnDShare-Local': '1' } })
const cacheKey = url => `${scope}http:${url.pathname}${[...url.searchParams].length ? '?' + [...url.searchParams].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&') : ''}`
const isLive = path => /\/(changes|events|stream)(\/|$)/.test(path) || path.startsWith('/api/session') || path.startsWith('/api/user/')
function accountDatabase(epoch = accountEpoch) {
  return { ...database, batch: changes => epoch === accountEpoch ? database.batch(changes) : Promise.resolve(), clear: prefix => epoch === accountEpoch ? database.clear(prefix) : Promise.resolve() }
}

const requestSource = (input, init = {}) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.href)
  return `${(init.method || input.method || 'GET').toUpperCase()} ${cacheKey(url)}`
}
async function observedNetwork(input, init = {}) {
  const epoch = accountEpoch, accountId = localState.accountId, source = requestSource(input, init)
  const method = (init.method || input.method || 'GET').toUpperCase()
  let response
  try { response = await network(input, { ...init, headers: apiHeaders(init.headers || input.headers) }) }
  catch (failure) {
    const error = failure && typeof failure === 'object' ? failure : new Error(String(failure))
    error.syncTransient = true
    throw error
  }
  if (epoch === accountEpoch && accountId === localState.accountId && accountId) {
    if (response.ok) resolveSyncProblem(source, { httpOnly: true })
    else if (response.status >= 500 || (response.status === 426 && method === 'GET')) {
      reportSyncProblem(Object.assign(new Error('Ошибка ответа сервера'), { status: response.status }), source, accountId)
    }
  }
  return response
}

export async function clearLocalAccount({ session = true } = {}) {
  accountEpoch++
  localState.accountId = null
  scope = 'public:'
  resetSyncProblems()
  controller?.abort()
  clearTimeout(refreshTimer)
  await outboxStorage()?.flush?.()
  await database.clear('account:')
  await database.clear('journal:')
  invalidateLocalHandbook()
  await database.batch([{ key: 'identity', value: null }])
  localStorage.clear()
  if (isAndroid && session) await nativeStore.clearSession()
}

async function identity(payload, login = false, epoch = accountEpoch) {
  if (epoch !== accountEpoch) return
  if (!payload?.auth || !payload.user?.id) {
    if (localState.accountId) await clearLocalAccount()
    return
  }
  const previous = await database.get('identity')
  if (epoch !== accountEpoch) return
  if (previous?.payload.user.id && previous.payload.user.id !== payload.user.id) await clearLocalAccount({ session: false })
  scope = `account:${payload.user.id}:`
  localState.accountId = payload.user.id
  // A local identity unlocks only downloaded data; the server checks all online rights.
  const expiresAt = login || !previous ? Date.now() + 30 * 86400000 : previous.expiresAt
  await database.batch([{ key: 'identity', value: { payload, expiresAt } }])
  if (login || !bootPromise) void synchronizeLocalData()
}

export function synchronizeLocalData() {
  if (!localState.accountId || bootPromise) return bootPromise
  controller?.abort()
  controller = new AbortController()
  clearTimeout(refreshTimer)
  const { signal } = controller
  const accountScope = scope, db = accountDatabase()
  bootPromise = (async () => {
    localState.syncing = true
    const read = async path => {
      const response = await observedNetwork(path, { signal })
      if (!response.ok) throw Object.assign(new Error(`Загрузка ${path}: ${response.status}`), { status: response.status })
      const payload = await response.json()
      if (!signal.aborted) await db.batch([{ key: `${accountScope}http:${path}`, value: { payload, time: Date.now() } }])
      return payload
    }
    try {
      const problems = await resumeLocalQueues(localState.accountId, signal)
      if (!signal.aborted) reportRecoveredSyncProblems(problems, url => requestSource(url, { method: 'PATCH' }), localState.accountId)
      const [sources, characters] = await Promise.all([read('/api/sources'), read('/api/chars'), read('/api/templates'), read('/api/item-types'), read('/api/suggest/types')])
      for (const character of characters.chars || characters.characters || []) {
        const uuid = character.uuid
        if (uuid && !signal.aborted) await read(`/api/char/${uuid}`)
      }
      for (const source of sources.sources || []) {
        for (const version of source.versions || []) {
          if (!signal.aborted) await read(`/api/content-sources?sourceVersionId=${version.id}`)
        }
        if (!signal.aborted) await syncHandbook(db, observedNetwork, accountScope, source.id, signal)
      }
      localState.online = true
      resolveSyncProblem('background')
    } catch (error) {
      if (!signal.aborted) {
        if (error.status === 401) await clearLocalAccount()
        else reportSyncProblem(error, 'background', localState.accountId)
      }
    } finally {
      localState.syncing = false
      bootPromise = null
      if (!signal.aborted && localState.accountId) refreshTimer = setTimeout(synchronizeLocalData, 300000)
    }
  })()
  return bootPromise
}

async function localFetch(input, init = {}) {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.href)
  const mutating = url.origin === location.origin && url.pathname.startsWith('/api/') && !['GET', 'HEAD'].includes((init.method || input.method || 'GET').toUpperCase())
  if (mutating) trackMutation(1)
  try { return await cachedFetch(input, init) } finally { if (mutating) trackMutation(-1) }
}
async function cachedFetch(input, init = {}) {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.href)
  if (url.origin !== location.origin || !url.pathname.startsWith('/api/')) return network(input, init)
  if (url.pathname === '/api/build-info' || url.pathname.startsWith('/api/frontend-updates/')) return network(input, { ...init, cache: 'no-store' })
  init = { ...init, headers: apiHeaders(init.headers || input.headers) }
  const method = (init.method || input.method || 'GET').toUpperCase()
  const epoch = accountEpoch, db = accountDatabase(epoch)
  const auth = url.pathname === '/api/user/checkAuth'
  const key = cacheKey(url)
  const cached = method === 'GET' ? await database.get(key) : null
  if (auth) {
    const saved = await database.get('identity')
    if (saved && saved.expiresAt > Date.now()) {
      void observedNetwork(input, init).then(async response => {
        if (epoch !== accountEpoch) return
        if (!response.ok) { if (response.status === 401) { await clearLocalAccount(); location.reload() } return }
        const payload = await response.json()
        await identity(payload, false, epoch)
        resolveSyncProblem(requestSource(input, init))
        if (!payload.auth) location.reload()
      }).catch(error => {
        if (epoch !== accountEpoch) return
        localState.online = false
        reportSyncProblem(error, requestSource(input, init), localState.accountId)
      })
      return json(saved.payload)
    }
  }
  if (method === 'GET' && (/^\/api\/items(?:\/search|\/by-ids)?$/.test(url.pathname) || /^\/api\/suggest\/\d|^\/api\/suggest\/batch$/.test(url.pathname)) && init.cache !== 'no-store') {
    const catalogue = await localHandbookResponse(scope, url)
    if (catalogue) return json(catalogue)
  }
  // Cached content is immediately usable. Live state/version reads always go to the server.
  if (cached && !isLive(url.pathname) && init.cache !== 'no-store') {
    void observedNetwork(input, init).then(async response => {
      if (epoch !== accountEpoch) return
      if (response.status === 401) { await clearLocalAccount(); location.reload(); return }
      if (response.ok && response.headers.get('content-type')?.includes('json')) await db.batch([{ key, value: { payload: await response.json(), time: Date.now() } }])
      if (response.ok) resolveSyncProblem(requestSource(input, init))
    }).catch(error => {
      if (epoch !== accountEpoch) return
      localState.online = false
      reportSyncProblem(error, requestSource(input, init), localState.accountId)
    })
    return json(cached.payload)
  }
  try {
    const response = await observedNetwork(input, init)
    if (epoch !== accountEpoch) return response
    localState.online = true
    if (response.status === 401) { await clearLocalAccount(); return response }
    if (method === 'GET' && response.status >= 500) {
      if (cached) return json(cached.payload)
      const catalogue = await localHandbookResponse(scope, url)
      if (catalogue) return json(catalogue)
    }
    if (response.ok && response.headers.get('content-type')?.includes('json')) {
      const payload = await response.clone().json()
      if (epoch !== accountEpoch) return response
      await updateConfirmedSnapshot(db, scope, url, payload, init)
      if (method !== 'GET' && /^\/api\/items(?:\/\d+(?:\/.*)?)?$/.test(url.pathname)) {
        const id = Number(url.pathname.split('/')[3] || payload.id || payload.item?.id)
        if (id) {
          try {
            const detail = await observedNetwork(`/api/items/${id}`)
            const item = detail.ok ? await detail.json() : null
            if (item && epoch === accountEpoch) {
              await saveCatalogueMutation(db, scope, item)
              resolveSyncProblem(`catalogue:${id}`)
            }
          } catch (error) {
            if (epoch === accountEpoch) reportSyncProblem(error, `catalogue:${id}`, localState.accountId)
          }
        }
      }
      if (auth || url.pathname === '/api/user/auth' || url.pathname === '/api/user/registration') await identity(payload, !auth, epoch)
      else if (method === 'GET' && !isLive(url.pathname)) await db.batch([{ key, value: { payload, time: Date.now() } }])
    }
    if (response.ok && method === 'DELETE' && /^\/api\/items\/\d+$/.test(url.pathname)) await saveCatalogueMutation(db, scope, null, url.pathname.split('/').at(-1))
    if (response.ok) resolveSyncProblem(requestSource(input, init))
    return response
  } catch (error) {
    if (init.signal?.aborted || error.name === 'AbortError') throw error
    if (epoch === accountEpoch) reportSyncProblem(error, requestSource(input, init), localState.accountId)
    localState.online = false
    if (method !== 'GET') throw error
    if (auth) {
      const saved = await database.get('identity')
      if (saved && saved.expiresAt > Date.now()) return json(saved.payload)
      return json({ auth: false })
    }
    if (isLive(url.pathname)) throw error
    if (cached) return json(cached.payload)
    const catalogue = await localHandbookResponse(scope, url)
    if (catalogue) return json(catalogue)
    throw new Error('Данные ещё не загружены на это устройство. Подключитесь к сети и повторите.')
  }
}

export async function initializeLocalPlatform() {
  database = await openLocalDatabase()
  await prepareLocalJournal()
  const saved = await database.get('identity')
  if (saved && saved.expiresAt > Date.now()) {
    localState.accountId = saved.payload.user.id
    scope = `account:${localState.accountId}:`
  }
  network = window.fetch.bind(window)
  window.fetch = localFetch
  localState.ready = true
  window.addEventListener('dndshare:platform-error', event => {
    resolveSyncProblem('platform')
    reportSyncProblem(event.detail, 'platform', localState.accountId)
  })
  window.addEventListener('online', () => { localState.online = true; void synchronizeLocalData() })
  window.addEventListener('offline', () => { localState.online = false })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void synchronizeLocalData()
    else void outboxStorage()?.flush?.().then(() => resolveSyncProblem('journal')).catch(error => { reportSyncProblem(error, 'journal', localState.accountId) })
  })
}
