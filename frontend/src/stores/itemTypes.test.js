import { describe, expect, it } from 'vitest'
import { relatedItemTypeIds } from './itemTypes'

describe('item type hierarchy', () => {
  it('returns a parent and every nested subsection exactly once', () => {
    const types = [
      { id: 2 },
      { id: 1, parentTypeId: 2 },
      { id: 10, parentTypeId: 2 },
      { id: 14, parentTypeId: 2 },
      { id: 20, parentTypeId: 14 },
    ]

    expect(relatedItemTypeIds(types, 2)).toEqual([2, 1, 10, 14, 20])
    expect(relatedItemTypeIds(types, 14, { includeRoot: false })).toEqual([20])
  })
})
