import { describe, expect, it } from 'vitest'

import { entryDisplayData } from './itemSection'

describe('inventory item presentation', () => {
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
    )

    expect(result).toMatchObject({ name: 'Верёвка', svg: '', isCustom: true })
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
