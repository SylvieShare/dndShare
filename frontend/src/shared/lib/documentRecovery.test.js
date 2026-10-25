import { afterEach, expect, it, vi } from 'vitest'
import { createDocumentSync } from './documentSync'
import { copyDocument, applyDocumentPatches, documentDiff } from './documentPatch'

const managers = []
afterEach(() => { managers.splice(0).forEach(sync => sync.stop()); vi.unstubAllGlobals() })
function memory(entries = []) {
  const values = new Map(entries)
  vi.stubGlobal('localStorage', {
    get length() { return values.size }, key: i => [...values.keys()][i] ?? null,
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key),
  })
  return values
}
const saved = (base, next) => JSON.stringify({ base, version: 1, queue: [{ patches: documentDiff(base, next), metadata: {} }], flight: null })
const create = options => { const sync = createDocumentSync(options); managers.push(sync); return sync }

it('preserves edits entered while an older queue is being recovered', async () => {
  memory([['resource', saved({ a: 0, b: 0 }, { a: 1, b: 0 })]])
  const sync = create({ data: { a: 0, b: 0 }, version: 1, storageKey: 'resource' })
  sync.edit({ a: 0, b: 2 })
  await sync.ready
  expect(sync.data).toEqual({ a: 1, b: 2 })
})

it('recovers multiple abandoned queues in order without dropping independent edits', async () => {
  const storage = memory([
    ['resource:queue:1', saved({ a: 0, b: 0 }, { a: 1, b: 0 })],
    ['resource:queue:2', saved({ a: 0, b: 0 }, { a: 0, b: 2 })],
  ])
  let data = { a: 0, b: 0 }, version = 1
  const send = vi.fn(async packet => {
    data = applyDocumentPatches(copyDocument(data), packet.patches)
    return { version: ++version, patches: packet.patches }
  })
  const sync = create({ data, version, storageKey: 'resource', send })
  expect(await sync.flush()).toBe(true)
  expect(send).toHaveBeenCalledTimes(2)
  expect(sync.data).toEqual({ a: 1, b: 2 })
  expect(storage.size).toBe(0)
})

it('keeps both conflicting queues until the user explicitly reloads the server snapshot', async () => {
  const storage = memory([['resource', saved({ a: 0 }, { a: 1 })]])
  const sync = create({ data: { a: 0 }, version: 1, storageKey: 'resource', load: async () => ({ data: { a: 3 }, version: 2 }) })
  sync.edit({ a: 2 })
  await sync.ready
  expect(sync.data.a).toBe(2)
  expect(storage.size).toBe(2)
  expect(await sync.flush()).toBe(false)
  await sync.reload()
  expect(sync.data.a).toBe(3)
  expect(storage.size).toBe(0)
})

it('does not delete the recovered record when writing its replacement fails', async () => {
  const original = saved({ a: 0 }, { a: 1 })
  const storage = memory([['resource', original]])
  localStorage.setItem = () => { throw new Error('quota') }
  const sync = create({ data: { a: 0 }, version: 1, storageKey: 'resource' })
  await sync.ready
  expect(sync.data.a).toBe(1)
  sync.stop()
  expect(storage.get('resource')).toBe(original)
})
