import { describe, expect, it } from 'vitest'
import { inventoryCellTraits } from './cellTraits'

describe('inventory cell capabilities', () => {
  it('marks simplified items with or without a selected image', () => {
    expect(inventoryCellTraits(null, { item_id: null, icon_preset_id: 11 })).toEqual({ simplified: true, wearable: false, usable: false })
    expect(inventoryCellTraits(null, { override: { consumable: true } }).usable).toBe(false)
  })
  it('shows both tags for wearable items with a use action', () => {
    expect(inventoryCellTraits({ typeId: 19, data: { activation: 'equipped', usable: {} } }, { item_id: 42 })).toEqual({ simplified: false, wearable: true, usable: true })
  })
  it('keeps a carried usable item distinct from wearable gear', () => {
    expect(inventoryCellTraits({ typeId: 19, data: { activation: 'carried', usable: {} } }, { item_id: 42 })).toEqual({ simplified: false, wearable: false, usable: true })
  })
  it('removes the use tag when the created item expires', () => {
    expect(inventoryCellTraits({ typeId: 2, data: { usable: {} } }, { item_id: 42, params: { creation: { expired: true } } }).usable).toBe(false)
  })
  it('recognizes equipment without depending on owner permissions', () => {
    expect(inventoryCellTraits({ typeId: 12 }, { item_id: 42 }).wearable).toBe(true)
    expect(inventoryCellTraits(null, { item_id: 42 }, true).wearable).toBe(true)
  })
})
