import { expect, it, vi } from 'vitest'
import { syncHandbook, filterLocalItems } from './handbook'
import { allLocalRecords } from './storage'
vi.mock('./storage', () => ({ allLocalRecords: vi.fn() }))

it.each([409, 426, 500, 504])('preserves HTTP %s when handbook synchronization fails', async status => {
  const db = { get: async () => null, batch: vi.fn() }
  const request = vi.fn(async () => Response.json({}, { status }))
  await expect(syncHandbook(db, request, 'account:1:', 1, new AbortController().signal)).rejects.toMatchObject({ status })
  expect(db.batch).not.toHaveBeenCalled()
})
it('marks an unsupported handbook protocol before writing local data', async () => {
  const db = { get: async () => null, batch: vi.fn() }
  await expect(syncHandbook(db, async () => Response.json({ protocol: 999, entries: [] }), 'account:1:', 1, new AbortController().signal)).rejects.toMatchObject({ code: 'SYNC_PROTOCOL' })
  expect(db.batch).not.toHaveBeenCalled()
})

it('commits a page with its cursor and resumes an interrupted download without losing tombstones', async () => {
  const records = new Map()
  const db = { get: async key => records.get(key), batch: vi.fn(async changes => { for (const { key, value } of changes) { if (value == null) records.delete(key); else records.set(key, value) } }) }
  allLocalRecords.mockImplementation(async prefix => [...records].filter(([key]) => key.startsWith(prefix)).map(([key, value]) => ({ key, value })))
  const request = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ protocol: 1, hasMore: true, nextCursor: 'page-two', entries: [{ id: 1, item: { id: 1 } }, { id: 2, item: { id: 2 } }] })))
    .mockRejectedValueOnce(new TypeError('offline'))
  await expect(syncHandbook(db, request, 'account:1:', 1, new AbortController().signal)).rejects.toThrow('offline')
  expect(db.batch.mock.calls[0][0].map(change => change.key)).toEqual(['account:1:handbook:1:item:1', 'account:1:handbook:1:item:2', 'account:1:handbook:1:position'])
  expect(records.get('account:1:handbook:1:position').cursor).toBe('page-two')
  request.mockResolvedValueOnce(new Response(JSON.stringify({ protocol: 1, hasMore: false, cursor: 'complete', visibleIds: [1], entries: [{ id: 2, deleted: true }] })))
  await syncHandbook(db, request, 'account:1:', 1, new AbortController().signal)
  expect(request.mock.calls[2][0]).toContain('cursor=page-two')
  expect(records.has('account:1:handbook:1:item:2')).toBe(false)
  expect(records.get('account:1:handbook:1:position')).toMatchObject({ cursor: 'complete', complete: true })
})

it('uses edition compatibility and keeps unclassified items visible under book filters', () => {
  const items = ['native', 'legacy', 'blocked', 'requires_adaptation'].map((status, index) => ({ id: index + 1, name: status, typeId: 1, compatibility: [{ sourceVersionId: 1, status }], data: {} }))
  expect(filterLocalItems(items, new URLSearchParams('typeId=1&sourceVersionId=1&contentSourceIds=99')).map(item => item.name)).toEqual(['native'])
  expect(filterLocalItems(items, new URLSearchParams('sourceVersionId=1&allowLegacy=true')).map(item => item.name)).toEqual(['legacy', 'native'])
})
