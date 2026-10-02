import { describe, expect, it } from 'vitest'
import { bagCells, bagColumnCount, resolveBagSlots } from './bagSlots'
import { cloneModel, normalizeValue } from '@/features/character-editor/blocks/dnd/lib/itemSection'

const entry = uid => ({ uid, count: 2, item_id: 12, params: { magic: { remaining: 3 } } })
const model = () => ({ equipped: [entry('worn')], sections: [
  { id: 'bag', items: [entry('a'), entry('b')], slots: { a: 0, b: 1 } },
  { id: 'chest', items: [entry('c')], slots: { c: 2 } },
] })

describe('bag cells', () => {
  it('fits cells to the available width and grows rows for the current column count', () => {
    expect(bagColumnCount(664)).toBe(8)
    expect(bagColumnCount(330)).toBe(4)
    expect(bagColumnCount(230)).toBe(2)
    expect(bagColumnCount(0)).toBe(1)
    expect(bagCells(['a', 'b', 'c', 'd'].map(entry), {}, undefined, 6)).toHaveLength(6)
    expect(bagCells(['a', 'b'].map(entry), {}, undefined, 2)).toHaveLength(4)
    expect(bagCells([entry('a')], { a: 7 }, undefined, 3)).toHaveLength(9)
  })

  it('starts with four empty cells and adds a row when the last row is filled', () => {
    expect(bagCells([])).toEqual([null, null, null, null])
    expect(bagCells(['a', 'b', 'c'].map(entry))).toHaveLength(4)
    expect(bagCells(['a', 'b', 'c', 'd'].map(entry))).toHaveLength(8)
    expect(bagCells(['a', 'b', 'c', 'd', 'e'].map(entry))).toHaveLength(8)
  })
  it('keeps holes, fills the first free cell, and ignores removed/invalid/duplicate positions', () => {
    const entries = ['a', 'b', 'c', 'd'].map(entry)
    const positions = { a: 5, b: 5, c: -1, removed: 99 }
    expect(resolveBagSlots(entries, positions)).toEqual({ a: 5, b: 0, c: 1, d: 2 })
    expect(bagCells(entries, positions)[3]).toBeNull()
    expect(positions).toEqual({ a: 5, b: 5, c: -1, removed: 99 })
  })
  it('keeps a partly filled last row without adding another row for its last cell', () => {
    expect(bagCells([entry('a')], { a: 3 })).toHaveLength(4)
    expect(bagCells([entry('a')], { a: 7 })).toHaveLength(8)
  })
  it('preserves layout through normalization and cloning', () => {
    const value = model()
    const cloned = cloneModel(normalizeValue(value))
    expect(cloned.sections[1].slots).toEqual({ c: 2 })
    cloned.sections[1].slots.c = 3
    expect(value.sections[1].slots.c).toBe(2)
  })
})
