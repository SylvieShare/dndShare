import { describe, expect, it } from 'vitest'
import {
  appendInventoryEntry,
  appendOwnedEntry,
  ownedEntryToWeapons,
  takeInventoryEntry,
} from './itemPlacement'

const inventory = {
  equipped: [],
  sections: [{ id: 'bag', name: 'Рюкзак', items: [{
    uid: 'rope', item_id: 423, count: 2, params: { length_ft: 50 }, override: null,
  }] }],
}

describe('owned item placement', () => {
  it('moves a full instance out of inventory without losing its parameters', () => {
    const result = takeInventoryEntry(inventory, 'bag', 'rope')
    expect(result.inventory.sections[0].items).toEqual([])
    expect(appendOwnedEntry([], result.entry)).toEqual([
      { uid: 'rope', item_id: 423, count: 2, params: { length_ft: 50 }, override: null },
    ])
  })

  it('returns a specialized entry to the first inventory section', () => {
    const next = appendInventoryEntry(null, {
      uid: 'tool', item_id: 44, count: 1, params: {}, override: null,
    })
    expect(next.sections[0].name).toBe('Рюкзак')
    expect(next.sections[0].items[0].item_id).toBe(44)
  })

  it('expands weapon quantity into independent weapon entries', () => {
    const entries = ownedEntryToWeapons({ item_id: 77, count: 2, params: { magic_bonus: 2 } })
    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({ item_id: 77, params: { magic_bonus: 2 } })
  })
})
