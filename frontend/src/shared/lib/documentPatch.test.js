import {readFileSync} from 'node:fs'
import { expect, it } from 'vitest'
import {
  documentDiff,
  applyDocumentPatches,
  rebaseDocumentChanges,
} from './documentPatch'

it('patches nested uid collections, insertion, deletion, ordering and null independently of array indexes', () => {
  const before = {
    sections: [
      {
        id: 's',
        items: [
          { uid: 'a', count: 1 },
          { uid: 'b', count: 2 },
          { uid: 'c', count: 3 },
        ],
      },
    ],
    nullable: null,
  }
  const after = {
    sections: [
      {
        id: 's',
        items: [
          { uid: 'c', count: 3 },
          { uid: 'd', count: 4 },
          { uid: 'a', count: 8 },
        ],
      },
    ],
    extra: false,
  }
  const patches = documentDiff(before, after),
    inverse = documentDiff(after, before)
  const target = structuredClone(before),
    untouched = target.sections[0].items[2]
  expect(applyDocumentPatches(target, patches)).toEqual(after)
  expect(target.sections[0].items[0]).toBe(untouched)
  expect(
    patches.some((patch) => patch.path.some((part) => part.idField === 'uid')),
  ).toBe(true)
  expect(applyDocumentPatches(target, inverse)).toEqual(before)
})
it('sends a changed leaf instead of a large containing collection', () => {
  const before = {
      items: Array.from({ length: 4096 }, (_, id) => ({
        uid: String(id),
        count: 1,
      })),
    },
    after = structuredClone(before)
  after.items[2000].count = 2
  const patches = documentDiff(before, after)
  expect(patches).toEqual([
    {
      op: 'set',
      path: ['items', { idField: 'uid', id: '2000' }, 'count'],
      value: 2,
    },
  ])
  expect(JSON.stringify(patches).length).toBeLessThan(150)
})
it('rebases independent edits and detects collisions without overwriting them', () => {
  const before = { a: 1, b: 1 },
    patches = documentDiff(before, { a: 2, b: 1 })
  expect(rebaseDocumentChanges(before, { a: 1, b: 4 }, patches).data).toEqual({
    a: 2,
    b: 4,
  })
  expect(
    rebaseDocumentChanges(before, { a: 2, b: 4 }, patches).patches,
  ).toEqual([])
  expect(() => rebaseDocumentChanges(before, { a: 3, b: 1 }, patches)).toThrow()
})
it('rejects prototype paths, missing identities and duplicate insertion', () => {
  expect(() =>
    applyDocumentPatches({}, [
      { op: 'set', path: ['__proto__', 'polluted'], value: true },
    ]),
  ).toThrow()
  expect(() =>
    applyDocumentPatches({ items: [{ id: 'x' }] }, [
      { op: 'remove', path: ['items', { idField: 'id', id: 'missing' }] },
    ]),
  ).toThrow()
  expect(() =>
    applyDocumentPatches({ items: [{ id: 'x' }] }, [
      {
        op: 'insert',
        path: ['items', { idField: 'id', id: 'x' }],
        value: { id: 'x' },
      },
    ]),
  ).toThrow()
})

it('matches the same patch contract as the Go backend',()=>{
 const cases=JSON.parse(readFileSync(new URL('../../../../internal/documentpatch/testdata/contract.json',import.meta.url),'utf8'))
 for(const entry of cases){
  expect(applyDocumentPatches(structuredClone(entry.before),entry.patches),entry.name).toEqual(entry.after)
  if(!entry.applyOnly)expect(documentDiff(entry.before,entry.after),entry.name).toEqual(entry.patches)
 }
})
