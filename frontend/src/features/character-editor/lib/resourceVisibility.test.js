import { expect, it } from 'vitest'
import { MAGIC_VALUE_ID } from './characterMagicItems'
import { resourceVisibilityPatch, resourceVisibleHere } from './resourceVisibility'
const row = { key: 'a', readonly: true, source: { valueId: MAGIC_VALUE_ID, entryKey: 'staff' } }
it('hides weapon pools, but makes the same pool visible after moving it to a bag', () => {
  expect(resourceVisibleHere(row, { weapon: [{ uid: 'staff' }] })).toBe(false)
  expect(resourceVisibleHere(row, { weapon: [], items: { equipped: [{ uid: 'staff' }] } })).toBe(true)
})
it('defaults to hidden for action/widget pools, and visible for a pool with no other presentation', () => {
  expect(resourceVisibleHere(row, {}, new Set(['a']))).toBe(false)
  expect(resourceVisibleHere(row, {}, new Set(), new Set(['a']))).toBe(false)
  expect(resourceVisibleHere(row, {}, new Set(['b']))).toBe(true)
})
it('respects an explicit per-character preference and preserves the other flags', () => {
  const values = { weapon: [{ uid: 'staff' }], resource_visibility: { other: false } }
  const patch = resourceVisibilityPatch(values, 'a', true)
  expect(patch).toEqual({ resource_visibility: { other: false, a: true } })
  expect(resourceVisibleHere(row, { ...values, ...patch })).toBe(true)
  expect(resourceVisibleHere(row, { resource_visibility: { a: false } })).toBe(false)
  expect(values.resource_visibility).toEqual({ other: false })
})
it('never hides custom resources or a separate weapon instance by default', () => {
  expect(resourceVisibleHere({ ...row, readonly: false }, { resource_visibility: { a: false } })).toBe(true)
  expect(resourceVisibleHere(row, { weapon: [{ uid: 'other-staff' }] })).toBe(true)
})
