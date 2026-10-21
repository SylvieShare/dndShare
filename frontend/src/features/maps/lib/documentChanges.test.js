import { expect, it } from 'vitest'
import { documentChanges, applyDocumentChanges } from './documentChanges'

it('reverses a transaction with record insertion/deletion, fields and reordering while preserving the server revision', () => {
  const before = {
    revision: 9,
    name: 'map',
    document: {
      tiles: [
        { id: 'a', x: 0 },
        { id: 'b', x: 1 },
        { id: 'c', x: 2 },
      ],
    },
  }
  const after = {
    revision: 10,
    name: 'other',
    document: {
      tiles: [
        { id: 'c', x: 2 },
        { id: 'a', x: 4 },
        { id: 'd', x: 3 },
      ],
    },
  }
  const changes = documentChanges(before, after)
  const target = structuredClone(before)
  const untouched = target.document.tiles[2]
  applyDocumentChanges(target, changes, true)
  expect(target).toEqual({ ...after, revision: 9 })
  expect(target.document.tiles[0]).toBe(untouched)
  target.revision = 11
  applyDocumentChanges(target, changes, false)
  expect(target).toEqual({ ...before, revision: 11 })
})
it('stores one changed entity on a large map and omits unchanged records', () => {
  const before = {
    document: {
      tiles: Array.from({ length: 4096 }, (_, i) => ({ id: String(i), x: i })),
    },
  }
  const after = structuredClone(before)
  after.document.tiles[2048].x++
  const changes = documentChanges(before, after)
  expect(changes.forward).toHaveLength(1)
  expect(changes.forward[0].path).toEqual([
    'document',
    'tiles',
    { idField: 'id', id: '2048' },
    'x',
  ])
  expect(JSON.stringify(changes).length).toBeLessThan(700)
})
