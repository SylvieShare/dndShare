import { afterEach, expect, it, vi } from 'vitest'
import { canonicalMapData } from './mapDocumentData'
import { createDocumentSync } from '../lib/documentSync'
import {
  applyDocumentPatches,
  copyDocument,
  documentDiff,
  rebaseDocumentChanges,
} from '../lib/documentPatch'
afterEach(() => vi.unstubAllGlobals())
const data = (mirrored) => ({
  name: 'Map',
  document: {
    tiles: [{ id: 'tile', ...(mirrored === undefined ? {} : { mirrored }) }],
  },
})

it('keeps the canonical map format without changing inputs or unrelated false values', () => {
  const input = data(false)
  input.document.grid = { visible: false }
  const output = canonicalMapData(input)
  expect(input.document.tiles[0].mirrored).toBe(false)
  expect(output.document.tiles[0]).toEqual({ id: 'tile' })
  expect(output.document.grid.visible).toBe(false)
  expect(canonicalMapData(data(true)).document.tiles[0].mirrored).toBe(true)
})
it('rebases a repeated mirror over its own acknowledgement while retaining real conflicts', () => {
  const off = data(false),
    canonical = data(),
    on = data(true)
  expect(
    rebaseDocumentChanges(
      off,
      canonical,
      documentDiff(off, on),
      canonicalMapData,
    ).data,
  ).toEqual(on)
  expect(() =>
    rebaseDocumentChanges(
      off,
      { ...canonical, name: 'Other' },
      [{ op: 'set', path: ['name'], value: 'Mine' }],
      canonicalMapData,
    ),
  ).toThrow('Одни и те же данные')
})
it('saves T twice during an in-flight request in one tab without a false conflict', async () => {
  let release,
    server = data(true),
    version = 1
  const packets = []
  const sync = createDocumentSync({
    data: server,
    version,
    canonicalize: canonicalMapData,
    send: async (packet) => {
      packets.push(copyDocument(packet))
      if (packets.length === 1)
        await new Promise((resolve) => {
          release = resolve
        })
      server = canonicalMapData(
        applyDocumentPatches(copyDocument(server), packet.patches),
      )
      return { version: ++version, data: server }
    },
  })
  sync.edit(data(false))
  const saving = sync.flush()
  sync.edit(data(true))
  release()
  expect(await saving).toBe(true)
  expect(packets).toHaveLength(2)
  expect(packets[0].patches).toEqual([
    {
      op: 'remove',
      path: ['document', 'tiles', { idField: 'id', id: 'tile' }, 'mirrored'],
    },
  ])
  expect(server).toEqual(data(true))
  expect(sync.data).toEqual(server)
  sync.stop()
})
it.each([false, true])(
  'recovers the existing outbox without changing the old packet (receipt=%s)',
  async (hasReceipt) => {
    const base = data(true),
      off = data(false),
      on = data(true)
    const patches = documentDiff(base, off)
    const saved = {
      base,
      version: 1,
      queue: [{ patches: documentDiff(off, on), metadata: {} }],
      flight: {
        packet: { baseVersion: 1, mutationId: 'already-accepted', patches },
        groups: [{ patches, metadata: {} }],
        receipt: { version: 2, data: data() },
      },
    }
    if (!hasReceipt) delete saved.flight.receipt
    const memory = new Map([['map', JSON.stringify(saved)]])
    vi.stubGlobal('localStorage', {
      getItem: (key) => memory.get(key),
      setItem: (key, value) => memory.set(key, value),
      removeItem: (key) => memory.delete(key),
    })
    const send = vi.fn(async (packet) => ({
      version: packet.baseVersion + 1,
      data: applyDocumentPatches(data(), packet.patches),
    }))
    const sync = createDocumentSync({
      data: data(),
      version: 2,
      storageKey: 'map',
      canonicalize: canonicalMapData,
      send,
    })
    expect(await sync.flush()).toBe(true)
    expect(sync.data).toEqual(on)
    expect(send).toHaveBeenCalledTimes(hasReceipt ? 1 : 2)
    if (!hasReceipt) expect(send.mock.calls[0][0]).toEqual(saved.flight.packet)
    expect(send.mock.calls.at(-1)[0].mutationId).not.toBe('already-accepted')
    expect(memory.has('map')).toBe(false)
    sync.stop()
  },
)
