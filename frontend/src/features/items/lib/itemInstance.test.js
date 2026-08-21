import { describe, expect, it } from 'vitest'
import {
  applicableInstanceFields,
  copperCost,
  defaultInstanceParams,
  instanceDisplayName,
  instanceParamsKey,
  measuredItemEconomy,
  normalizeInstanceParams,
} from './itemInstance'

const lengthField = {
  key: 'length_ft', name: 'Длина', type: 'int', min: 1, default: 50, unit: 'фт.',
  applies_when: { item_data_key: 'measurement', value: 'length' },
  unit_cost_data_key: 'unit_cost_copper', unit_weight_data_key: 'unit_weight',
}

describe('typed item instance parameters', () => {
  it('applies item-type fields only to matching handbook rows', () => {
    const type = { instanceFields: [lengthField] }
    const rope = { name: 'Верёвка пеньковая', data: { measurement: 'length' } }
    expect(applicableInstanceFields(type, rope)).toEqual([lengthField])
    expect(defaultInstanceParams(type, rope)).toEqual({ length_ft: 50 })
    expect(applicableInstanceFields(type, { data: {} })).toEqual([])
  })

  it('normalizes bounds and produces a stable variant key', () => {
    expect(normalizeInstanceParams({ length_ft: 0 }, [lengthField])).toEqual({ length_ft: 1 })
    expect(instanceParamsKey({ b: 2, a: 1 })).toBe(instanceParamsKey({ a: 1, b: 2 }))
  })

  it('renders the concrete value without changing the handbook name', () => {
    const type = { instanceFields: [lengthField] }
    const rope = { name: 'Верёвка шёлковая', data: { measurement: 'length' } }
    expect(instanceDisplayName(rope, { length_ft: 30 }, type)).toBe('Верёвка шёлковая · 30 фт.')
    expect(rope.name).toBe('Верёвка шёлковая')
  })

  it('derives handbook economy from the default measured instance', () => {
    const type = { instanceFields: [lengthField] }
    const hemp = { data: { measurement: 'length', unit_cost_copper: 2, unit_weight: 0.2 } }
    const silk = { data: { measurement: 'length', unit_cost_copper: 20, unit_weight: 0.1 } }

    expect(measuredItemEconomy(type, hemp)).toEqual({
      quantity: 50, unit: 'фт.', costCopper: 100, cost: { value: 1, suggest_id: 3 }, weight: 10,
    })
    expect(measuredItemEconomy(type, silk)).toEqual({
      quantity: 50, unit: 'фт.', costCopper: 1000, cost: { value: 10, suggest_id: 3 }, weight: 5,
    })
    expect(measuredItemEconomy(type, hemp, { length_ft: 30 })).toMatchObject({
      quantity: 30, costCopper: 60, cost: { value: 6, suggest_id: 2 }, weight: 6,
    })
    expect(copperCost(23)).toEqual({ value: 23, suggest_id: 1 })
  })
})
