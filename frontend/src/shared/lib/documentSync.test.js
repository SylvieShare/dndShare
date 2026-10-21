import { afterEach, expect, it, vi } from 'vitest'
import { createDocumentSync } from './documentSync'
afterEach(() => vi.useRealTimers())
it('freezes a failed packet and preserves edits queued while it is in flight', async () => {
  vi.useFakeTimers()
  const packets = []
  let release
  const send = vi.fn(async (packet) => {
    packets.push(packet)
    if (packets.length === 1)
      await new Promise((resolve) => {
        release = resolve
      })
    if (packets.length === 1) throw new Error('offline')
    return { version: packet.baseVersion + 1, patches: packet.patches }
  })
  const sync = createDocumentSync({ data: { a: 1, b: 1 }, version: 1, send })
  sync.edit({ a: 2, b: 1 })
  const first = sync.flush()
  sync.edit({ a: 2, b: 3 })
  release()
  await first
  await vi.advanceTimersByTimeAsync(1000)
  expect(packets).toHaveLength(3)
  expect(packets[1]).toEqual(packets[0])
  expect(packets[2].baseVersion).toBe(2)
  expect(sync.data).toEqual({ a: 2, b: 3 })
  expect(sync.version).toBe(3)
  sync.stop()
})
it('rebases disjoint remote edits after a conflict, but does not retry forbidden requests', async () => {
  let first = true
  const send = vi.fn(async (packet) => {
    if (first) {
      first = false
      throw { status: 409 }
    }
    return { version: 3, patches: packet.patches }
  })
  const sync = createDocumentSync({
    data: { a: 1, b: 1 },
    version: 1,
    send,
    load: async () => ({ version: 2, data: { a: 1, b: 4 } }),
  })
  sync.edit({ a: 2, b: 1 })
  expect(await sync.flush()).toBe(true)
  expect(sync.data).toEqual({ a: 2, b: 4 })
  expect(send.mock.calls[1][0].baseVersion).toBe(2)
  const forbidden = vi.fn().mockRejectedValue({ status: 403 })
  const denied = createDocumentSync({
    data: { a: 1 },
    version: 1,
    send: forbidden,
  })
  denied.edit({ a: 2 })
  expect(await denied.flush()).toBe(false)
  expect(await denied.flush()).toBe(false)
  expect(forbidden).toHaveBeenCalledOnce()
})
it('undo sends an inverse change and refuses to overwrite a remote update', async () => {
  const sync = createDocumentSync({
    data: { a: 1 },
    version: 1,
    send: async (packet) => ({
      version: packet.baseVersion + 1,
      patches: packet.patches,
    }),
  })
  sync.edit({ a: 2 })
  await sync.flush()
  expect(sync.undo()).toBe(true)
  await sync.flush()
  expect(sync.data).toEqual({ a: 1 })
  expect(sync.redo()).toBe(true)
  await sync.flush()
  sync.receive({ version: 5, data: { a: 4 } })
  expect(sync.undo()).toBe(false)
  expect(sync.data).toEqual({ a: 4 })
})
it('queues repeated changes of an in-flight field against its acknowledged value', async () => {
  let release
  const send = vi.fn((packet) =>
    send.mock.calls.length === 1
      ? new Promise((resolve) => {
          release = () => resolve({ version: 2, patches: packet.patches })
        })
      : Promise.resolve({ version: 3, patches: packet.patches }),
  )
  const sync = createDocumentSync({ data: { hp: 10 }, version: 1, send })
  sync.edit({ hp: 9 })
  const saving = sync.flush()
  sync.edit({ hp: 8 })
  release()
  expect(await saving).toBe(true)
  expect(sync.data.hp).toBe(8)
  expect(sync.version).toBe(3)
})
it('restores an immutable outbox after a lost acknowledgement without duplicating events', async () => {
  vi.useFakeTimers()
  const storage = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (key) => storage.get(key),
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  })
  let savedPacket
  const first = createDocumentSync({
    data: { hp: 10 },
    version: 1,
    storageKey: 'outbox',
    send: async (packet) => {
      savedPacket = packet
      throw new Error('lost response')
    },
  })
  first.edit({ hp: 9 }, { events: [{ clientActionId: 'once' }] })
  await first.flush()
  first.stop()
  const send = vi.fn(async (packet) => ({
    version: 2,
    patches: packet.patches,
  }))
  const restored = createDocumentSync({
    data: { hp: 10 },
    version: 1,
    storageKey: 'outbox',
    send,
  })
  expect(restored.data.hp).toBe(9)
  await restored.flush()
  expect(send.mock.calls[0][0]).toEqual(savedPacket)
  expect(storage.size).toBe(0)
  restored.stop()
  vi.unstubAllGlobals()
})
it('keeps remote snapshots deferred until a pending request is acknowledged', async () => {
  let release
  const sync = createDocumentSync({
    data: { hp: 10, name: 'A' },
    version: 1,
    send: (packet) =>
      new Promise(
        (resolve) =>
          (release = () => resolve({ version: 2, patches: packet.patches })),
      ),
    load: async () => ({ version: 3, data: { hp: 9, name: 'B' } }),
  })
  sync.edit({ hp: 9, name: 'A' })
  const saving = sync.flush()
  await sync.catchUp()
  release()
  await saving
  expect(sync.data).toEqual({ hp: 9, name: 'B' })
  expect(sync.version).toBe(3)
})
it('does not resend acknowledged semantic events when canonical data conflicts with a later edit', async () => {
  let release
  const send = vi.fn(
    () =>
      new Promise((resolve) => {
        release = () =>
          resolve({
            version: 2,
            patches: [{ op: 'set', path: ['name'], value: 'Canonical' }],
          })
      }),
  )
  const load = vi.fn(async () => ({ version: 2, data: { name: 'Canonical' } }))
  const sync = createDocumentSync({
    data: { name: 'A' },
    version: 1,
    send,
    load,
  })
  sync.edit({ name: 'B' }, { events: [{ clientActionId: 'once' }] })
  const saving = sync.flush()
  sync.edit({ name: 'C' })
  release()
  expect(await saving).toBe(false)
  expect(sync.data.name).toBe('C')
  expect(await sync.retry()).toBe(false)
  expect(send).toHaveBeenCalledOnce()
  await sync.reload()
  expect(sync.data.name).toBe('Canonical')
  sync.stop()
})
it('keeps retrying the immutable packet when conflict recovery temporarily fails', async () => {
  vi.useFakeTimers()
  let first = true
  const packets = []
  const sync = createDocumentSync({
    data: { x: 1 },
    version: 1,
    send: async (packet) => {
      packets.push(packet)
      if (first) {
        first = false
        throw { status: 409 }
      }
      return { version: 2, patches: packet.patches }
    },
    load: async () => {
      throw { status: 503 }
    },
  })
  sync.edit({ x: 2 })
  await sync.flush()
  await vi.advanceTimersByTimeAsync(1000)
  expect(packets).toHaveLength(2)
  expect(packets[0]).toEqual(packets[1])
  expect(sync.version).toBe(2)
  sync.stop()
})
it('retries the original mutation after reopening against a newer server snapshot', async () => {
  const storage = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (key) => storage.get(key),
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  })
  const packet = {
    baseVersion: 1,
    mutationId: 'lost-ack',
    patches: [{ op: 'set', path: ['hp'], value: 9 }],
    metadata: [{ events: [{ clientActionId: 'one-event' }] }],
  }
  const groups = [{ patches: packet.patches, metadata: packet.metadata[0] }]
  storage.set(
    'newer',
    JSON.stringify({
      base: { hp: 10 },
      version: 1,
      queue: [],
      flight: { packet, groups },
    }),
  )
  const send = vi.fn(async (received) => ({
    version: 2,
    patches: received.patches,
  }))
  const sync = createDocumentSync({
    data: { hp: 9 },
    version: 2,
    storageKey: 'newer',
    send,
  })
  await sync.flush()
  expect(send.mock.calls[0][0]).toEqual(packet)
  expect(send).toHaveBeenCalledOnce()
  expect(sync.data.hp).toBe(9)
  sync.stop()
  vi.unstubAllGlobals()
})
it('captures event metadata before callers mutate their source objects', async () => {
  const send = vi.fn(async (packet) => ({
    version: 2,
    patches: packet.patches,
  }))
  const sync = createDocumentSync({ data: { x: 1 }, version: 1, send })
  const metadata = { events: [{ clientActionId: 'once', data: { value: 1 } }] }
  sync.edit({ x: 2 }, metadata)
  metadata.events[0].data.value = 99
  await sync.flush()
  expect(send.mock.calls[0][0].metadata[0].events[0].data.value).toBe(1)
  sync.stop()
})
