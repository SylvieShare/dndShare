import { describe, expect, it } from 'vitest'
import {
  applicableInstanceFields,
  defaultInstanceParams,
  instanceDisplayName,
  instanceParamsKey,
  normalizeInstanceParams,
} from './itemInstance'

const lengthField = {
  key: 'length_ft', name: 'Длина', type: 'int', min: 1, default: 50, unit: 'фт.',
  applies_when: { item_data_key: 'measurement', value: 'length' },
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
})
