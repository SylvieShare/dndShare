import { describe, expect, it } from 'vitest'
import { inventoryMembershipChanges, inventoryQuantityDelta } from './inventoryMotion'

const snapshot = (local, all = local) => ({ rows: local.map(key => ({ key })), keys: new Set(all) })

describe('inventory animation identity', () => {
  it('distinguishes a new item and a removed stack', () => {
    expect(inventoryMembershipChanges(snapshot(['rope', 'torch']), snapshot(['rope', 'key']))).toEqual({ added: ['key'], removed: ['torch'] })
  })
  it('does not treat a move between spaces or equipment states as deletion or creation', () => {
    expect(inventoryMembershipChanges(snapshot(['rope'], ['rope', 'torch']), snapshot(['torch'], ['rope', 'torch']))).toEqual({ added: [], removed: [] })
  })
  it('does not animate reordering and responsive slot changes', () => {
    expect(inventoryMembershipChanges(snapshot(['rope', 'torch']), snapshot(['torch', 'rope']))).toEqual({ added: [], removed: [] })
  })
  it('distinguishes positive and negative quantity changes on the same instance', () => {
    expect(inventoryQuantityDelta({ key: 'rope', count: 2 }, { key: 'rope', count: 3 })).toBe(1)
    expect(inventoryQuantityDelta({ key: 'rope', count: 2 }, { key: 'rope', count: 1 })).toBe(-1)
  })
  it('does not animate quantity when another item replaces the cell content', () => {
    expect(inventoryQuantityDelta({ key: 'rope', count: 2 }, { key: 'torch', count: 3 })).toBe(0)
  })
  it('does not turn full removal or invalid counts into a quantity pulse', () => {
    expect(inventoryQuantityDelta({ key: 'rope', count: 1 }, { key: 'rope', count: 0 })).toBe(0)
    expect(inventoryQuantityDelta({ key: 'rope', count: 2 }, { key: 'rope', count: NaN })).toBe(0)
  })
})
