import { beforeEach, expect, it } from 'vitest'
import { localSyncProblems, reportSyncProblem, resetSyncProblems, resolveSyncProblem, syncProblem } from './localSyncProblems'

beforeEach(resetSyncProblems)
it.each([
  { syncTransient: true }, { name: 'AbortError' }, { name: 'TimeoutError' },
  { status: 408 }, { status: 504 }, { status: 429 }, { status: 401 },
])('keeps transient failures silent: %j', error => {
  expect(syncProblem(error)).toBeNull()
  reportSyncProblem(error, 'background', 1)
  expect(localSyncProblems.event).toBeNull()
})
it.each([500, 502, 503])('reports actual HTTP %s as a server problem', status => {
  reportSyncProblem({ status }, 'GET /a', 1)
  expect(localSyncProblems.event).toMatchObject({ accountId: 1, group: 'server', message: expect.stringContaining(String(status)) })
})
it.each([{ status: 409, group: 'conflict' }, { status: 426, group: 'version' }, { code: 'SYNC_PROTOCOL', group: 'version' }])('reports version failures: %j', ({ group, ...error }) => {
  reportSyncProblem(error, 'background', 1)
  expect(localSyncProblems.event.group).toBe(group)
})
it('deduplicates an outage across requests until every affected request recovers', () => {
  reportSyncProblem({ status: 500 }, 'GET /a', 1)
  const first = localSyncProblems.event.id
  reportSyncProblem({ status: 503 }, 'GET /b', 1)
  reportSyncProblem({ status: 500 }, 'GET /a', 1)
  expect(localSyncProblems.event.id).toBe(first)
  resolveSyncProblem('GET /a')
  reportSyncProblem({ status: 500 }, 'GET /a', 1)
  expect(localSyncProblems.event.id).toBe(first)
  resolveSyncProblem('GET /a')
  resolveSyncProblem('GET /b')
  expect(localSyncProblems.event).toBeNull()
  reportSyncProblem({ status: 500 }, 'GET /a', 1)
  expect(localSyncProblems.event.id).toBeGreaterThan(first)
})
it('does not resolve a storage problem merely because HTTP succeeded', () => {
  reportSyncProblem(new Error('disk full'), 'GET /a', 1)
  const first = localSyncProblems.event.id
  resolveSyncProblem('GET /a', { httpOnly: true })
  reportSyncProblem(new Error('disk full'), 'GET /a', 1)
  expect(localSyncProblems.event.id).toBe(first)
  resolveSyncProblem('GET /a')
  expect(localSyncProblems.event).toBeNull()
})
it('distinguishes local outbox read failures from HTTP 507', () => {
  const error = Object.assign(new Error('Не удалось прочитать сохранённые изменения.'), { status: 507, cause: new Error('storage unavailable') })
  reportSyncProblem(error, 'PATCH /a', 1)
  expect(localSyncProblems.event).toMatchObject({ group: 'local:storage', message: error.message })
  resolveSyncProblem('PATCH /a', { httpOnly: true })
  expect(localSyncProblems.event).not.toBeNull()
  expect(syncProblem({ status: 507 }).group).toBe('server')
})
it('ignores anonymous errors and resets incident history on account cleanup', () => {
  reportSyncProblem({ status: 500 }, 'GET /a', null)
  expect(localSyncProblems.event).toBeNull()
  reportSyncProblem({ status: 500 }, 'GET /a', 1)
  const first = localSyncProblems.event.id
  resetSyncProblems()
  reportSyncProblem({ status: 500 }, 'GET /a', 2)
  expect(localSyncProblems.event).toMatchObject({ accountId: 2 })
  expect(localSyncProblems.event.id).toBeGreaterThan(first)
})
