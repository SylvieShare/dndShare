import { beforeEach, expect, it, vi } from 'vitest'
import { createDocumentSync } from '../shared/lib/documentSync'
import { resumeLocalQueues } from './recoverQueues'
import { localSyncProblems, reportRecoveredSyncProblems, resetSyncProblems } from './localSyncProblems'

const memory = vi.hoisted(() => ({ storage: null }))
vi.mock('./journal', () => ({ outboxStorage: () => memory.storage }))
beforeEach(() => {
  const records = new Map()
  memory.storage = { get length() { return records.size }, key: index => [...records.keys()][index],
    getItem: key => records.get(key) ?? null, setItem: (key, value) => records.set(key, value), removeItem: key => records.delete(key) }
  resetSyncProblems()
})
async function pendingQueue() {
  const sync = createDocumentSync({ data: { a: 1 }, version: 1, storageKey: 'dndshare.document-pending.v1.character:1:hero', send: async () => { throw new TypeError('offline') } })
  try { await sync.ready; sync.edit({ a: 2 }); await sync.flush() } finally { sync.stop() }
}
it.each([403, 426, 409])('surfaces a blocked background queue (%s), then clears its incident after successful recovery', async status => {
  await pendingQueue()
  let failure = true
  const fetch = vi.fn(async (_url, options) => {
    if (options.method === 'PATCH') {
      if (failure) return Response.json({ desc: 'cannot apply' }, { status })
      const packet = JSON.parse(options.body)
      return Response.json({ version: packet.baseVersion + 1, mutationId: packet.mutationId, patches: packet.patches })
    }
    return Response.json({ version: 2, data: { a: 3 } })
  })
  vi.stubGlobal('fetch', fetch)
  try {
    const problems = await resumeLocalQueues(1, new AbortController().signal)
    const originalPacket = JSON.parse(fetch.mock.calls.find(([, options]) => options.method === 'PATCH')[1].body)
    expect(problems).toHaveLength(1)
    expect(problems[0].error.status).toBe(status)
    reportRecoveredSyncProblems(problems, url => url, 1)
    const first = localSyncProblems.event.id
    reportRecoveredSyncProblems(problems, url => url, 1)
    expect(localSyncProblems.event.id).toBe(first)
    if (status === 409) {
      // Explicitly discarding the pending draft removes its background problem.
      while (memory.storage.length) memory.storage.removeItem(memory.storage.key(0))
    } else failure = false
    const after = await resumeLocalQueues(1, new AbortController().signal)
    expect(after).toEqual([])
    if (status !== 409) {
      const packets = fetch.mock.calls.filter(([, options]) => options.method === 'PATCH').map(([, options]) => JSON.parse(options.body))
      expect(packets.at(-1)).toEqual(originalPacket)
    }
    reportRecoveredSyncProblems(after, url => url, 1)
    expect(localSyncProblems.event).toBeNull()
  } finally { vi.unstubAllGlobals() }
})
