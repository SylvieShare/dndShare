import { describe, expect, it } from 'vitest'

import { entryDisplayData, inventoryEntriesWeight, normalizeValue } from './itemSection'
import { inventorySpaceEntries, moveInventoryCell, toggleInventoryEquipment } from './inventorySpaces'

describe('inventory space weight', () => {
  const catalog = {
    1: { data: { purchase_quantity: 20, weight: 1 } },
    2: { data: { unit_weight: 0.2 } },
    3: { typeId: 1, data: { weight: 3 } },
    4: { typeId: 19, data: { weight: 4, weapon: {} } },
  }

  it('sums partial packages, measured items, custom weights and magic weapons once per stack', () => {
    expect(inventoryEntriesWeight([
      { item_id: 1, count: 13 },
      { item_id: 2, count: 2, params: { length_ft: 30 } },
      { item_id: null, count: 3, override: { weight: 0.1 } },
      { item_id: 3, magic_item_id: 4, count: 1 },
    ], catalog)).toBe(16.95)
  })

  it('counts equipped items in their physical space and updates both totals after moving them', () => {
    const model = normalizeValue({ equipped: [], sections: [
      { id: 'bag', items: [{ uid: 'weapon', item_id: 3 }, { uid: 'arrows', item_id: 1, count: 13 }] },
      { id: 'chest', items: [] },
    ] })
    const weight = id => inventoryEntriesWeight(inventorySpaceEntries(model, id), catalog)
    toggleInventoryEquipment(model, 'weapon')
    expect(weight('bag')).toBe(3.65)
    expect(weight('chest')).toBe(0)
    moveInventoryCell(model, { uid: 'weapon', fromId: 'bag', toId: 'chest', toSlot: 0 })
    expect(weight('bag')).toBe(0.65)
    expect(weight('chest')).toBe(3)
  })

  it('keeps empty spaces at zero and ignores unspecified or invalid weights', () => {
    expect(inventoryEntriesWeight([], catalog)).toBe(0)
    expect(inventoryEntriesWeight([
      { item_id: null }, { item_id: 999 },
      { item_id: null, override: { weight: 'invalid' } },
      { item_id: null, override: { weight: Infinity } },
      { item_id: null, override: { weight: 0.1 } },
      { item_id: null, override: { weight: 0.2 } },
    ], catalog)).toBe(0.3)
  })
})

describe('inventory item presentation', () => {
  it('presents the exact economy of 13 owned arrows rather than 13 packages', () => {
    expect(entryDisplayData({ item_id: 347, count: 13 }, {
      347: { name: 'Стрела', data: { purchase_quantity: 20, weight: 1, cost: { value: 1, suggest_id: 3 } } },
    })).toMatchObject({ weight: 0.65, cost: { value: 0.65, suggest_id: 3 } })
  })
  it('exposes the handbook SVG for a referenced item', () => {
    const svg = '<svg viewBox="0 0 24 24"><path d="M3 3h18v18H3z"/></svg>'
    const result = entryDisplayData(
      { item_id: 47, params: {}, override: null },
      { 47: { id: 47, name: 'Алебарда', svg, data: {} } },
    )

    expect(result).toMatchObject({ name: 'Алебарда', svg, isCustom: false })
  })

  it('marks a simplified entry for the dedicated placeholder icon', () => {
    const result = entryDisplayData(
      { item_id: null, params: {}, override: { name: 'Верёвка' } },
      {},
      { 2: { iconImageUrl: '/mystery-cube.webp' } },
    )

    expect(result).toMatchObject({ name: 'Верёвка', svg: '', isCustom: true, typeImageUrl: '/mystery-cube.webp' })
  })

  it('uses the block collection for simplified entries', () => {
    expect(entryDisplayData({ item_id: null }, {}, {
      2: { iconImageUrl: '/items.webp' },
      19: { iconImageUrl: '/magic.webp' },
    }, 19).typeImageUrl).toBe('/magic.webp')
  })

  it('keeps a referenced item SVG ahead of the collection placeholder', () => {
    expect(entryDisplayData({ item_id: 47 }, {
      47: { name: 'Предмет', typeId: 2, svg: '<svg/>', data: {} },
    }, { 2: { iconImageUrl: '/mystery-cube.webp' } }).typeImageUrl).toBe('')
  })

  it('does not invent an icon for a referenced item without SVG', () => {
    const result = entryDisplayData(
      { item_id: 9001, params: {}, override: null },
      { 9001: { id: 9001, name: 'Авторский предмет', data: {} } },
    )

    expect(result).toMatchObject({ svg: '', isCustom: false })
  })

  it('derives measured display, cost and weight from instance params', () => {
    const result = entryDisplayData(
      { item_id: 12, count: 1, params: { length_ft: 30 }, override: null },
      { 12: { id: 12, typeId: 2, name: 'Верёвка пеньковая', data: { measurement: 'length', unit_cost_copper: 2, unit_weight: 0.2 } } },
      { 2: { instanceFields: [{ key: 'length_ft', name: 'Длина', type: 'int', unit: 'фт.', applies_when: { item_data_key: 'measurement', value: 'length' } }] } },
    )
    expect(result).toMatchObject({
      name: 'Верёвка пеньковая · 30 фт.',
      cost: { value: 60, suggest_id: 1 },
      weight: 6,
    })
  })
})
