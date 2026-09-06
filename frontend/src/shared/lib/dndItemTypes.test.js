import { describe, expect, it } from 'vitest'
import {
  CLASS_ITEM_TYPE,
  RACE_ITEM_TYPE,
  SUBCLASS_ITEM_TYPE,
  SUBRACE_ITEM_TYPE,
  itemReferenceId,
  originChildren,
  originFilterQuery,
} from './dndItemTypes'

describe('D&D origin item types', () => {
  it('keeps base and variant catalogues distinct', () => {
    expect([RACE_ITEM_TYPE, SUBRACE_ITEM_TYPE, CLASS_ITEM_TYPE, SUBCLASS_ITEM_TYPE]).toEqual([8, 16, 9, 17])
  })

  it('resolves both scalar and object item references', () => {
    expect(itemReferenceId(12)).toBe(12)
    expect(itemReferenceId({ id: '13' })).toBe(13)
    expect(itemReferenceId(null)).toBeNull()
  })

  it('uses the base item reverse relation to select variants', () => {
    const parent = { id: 4, data: { subclasses: [{ id: 7 }, 9] } }
    const candidates = [{ id: 8, data: { class: 4 } }, { id: 9 }, { id: 7 }, { id: 10, data: { class: 5 } }]
    expect(originChildren(parent, candidates, 'subclasses').map(item => item.id)).toEqual([8, 9, 7])
  })

  it('builds a server filter for a child-to-parent item field', () => {
    expect(decodeURIComponent(originFilterQuery('race', { id: 42 }))).toBe('&filters={"race":[42]}')
  })
})
