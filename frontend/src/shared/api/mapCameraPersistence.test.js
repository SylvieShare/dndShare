import { afterEach, expect, it, vi } from 'vitest'
import { canonicalMapData } from './mapDocumentData'
import { createDocumentSync } from '../lib/documentSync'
import {
  applyDocumentPatches,
  documentDiff,
  rebaseDocumentChanges,
} from '../lib/documentPatch'

afterEach(() => vi.unstubAllGlobals())
const camera = {
  id: 'camera',
  name: 'Вход',
  view: {
    position: [0, 1.23456789, 5],
    target: [0, 0, 0],
    up: [0, 0, 1],
    width: 12,
    aspect: 1.6,
  },
}
const data = (cameras) => ({
  name: 'Map',
  document: { tiles: [], ...(cameras === undefined ? {} : { cameras }) },
})

it('omits only an empty camera list, preserves camera values and never mutates snapshots', () => {
  const empty = data([]),
    full = data([camera])
  expect(canonicalMapData(empty)).toEqual(data())
  expect(empty.document.cameras).toEqual([])
  expect(canonicalMapData(full)).toBe(full)
  expect(canonicalMapData(data(null))).toEqual(data(null))
})

it('rebases undo of the last deletion over its own omitted camera list', () => {
  const empty = data([]),
    restored = data([camera])
  expect(
    rebaseDocumentChanges(
      empty,
      data(),
      documentDiff(empty, restored),
      canonicalMapData,
    ).data,
  ).toEqual(restored)
  const renamed = data([{ ...camera, name: 'Моё имя' }])
  expect(() =>
    rebaseDocumentChanges(
      restored,
      data([{ ...camera, name: 'Чужое имя' }]),
      documentDiff(restored, renamed),
      canonicalMapData,
    ),
  ).toThrow('Одни и те же данные')
})

it.each([false, true])(
  'restores a queued camera undo after deletion without rewriting its packet (receipt=%s)',
  async (hasReceipt) => {
    const base = data([camera]),
      empty = data([])
    const patches = documentDiff(base, empty)
    const saved = {
      base,
      version: 1,
      queue: [{ patches: documentDiff(empty, base), metadata: {} }],
      flight: {
        packet: {
          baseVersion: 1,
          mutationId: 'accepted-camera-delete',
          patches,
        },
        groups: [{ patches, metadata: {} }],
        receipt: { version: 2, data: data() },
      },
    }
    if (!hasReceipt) delete saved.flight.receipt
    const memory = new Map([['camera-outbox', JSON.stringify(saved)]])
    vi.stubGlobal('localStorage', {
      getItem: (key) => memory.get(key),
      setItem: (key, value) => memory.set(key, value),
      removeItem: (key) => memory.delete(key),
    })
    const send = vi.fn(async (packet) =>
      packet.mutationId === 'accepted-camera-delete'
        ? saved.flight.receipt || { version: 2, data: data() }
        : { version: 3, data: applyDocumentPatches(data(), packet.patches) },
    )
    const sync = createDocumentSync({
      data: data(),
      version: 2,
      storageKey: 'camera-outbox',
      canonicalize: canonicalMapData,
      send,
    })
    try {
      expect(await sync.flush()).toBe(true)
      expect(sync.data).toEqual(base)
      expect(send).toHaveBeenCalledTimes(hasReceipt ? 1 : 2)
      if (!hasReceipt)
        expect(send.mock.calls[0][0]).toEqual(saved.flight.packet)
      expect(memory.has('camera-outbox')).toBe(false)
    } finally {
      sync.stop()
    }
  },
)
