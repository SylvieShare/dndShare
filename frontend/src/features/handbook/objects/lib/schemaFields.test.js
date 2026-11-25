import { describe, expect, it } from 'vitest'
import { collectItemRefIds, missingRequiredField, normalizeDataForSave } from './schemaFields'

describe('normalizeDataForSave', () => {
  it('keeps system dice as canonical strings at every schema depth', () => {
    const fields = [
      { key: 'hit_die', type: 'dice' },
      { key: 'damage', type: 'object', fields: [
        { key: 'dices', type: 'object_array', fields: [
          { key: 'dice_id', type: 'dice' },
          { key: 'count', type: 'int' },
        ] },
      ] },
    ]

    expect(normalizeDataForSave({
      hit_die: 'd6',
      damage: { dices: [{ dice_id: 'd10', count: 2 }] },
    }, fields)).toEqual({
      hit_die: 'd6',
      damage: { dices: [{ dice_id: 'd10', count: 2 }] },
    })
  })
})

describe('item reference fields', () => {
  const field = { key: 'item', type: 'item', required: true }

  it('collects numeric IDs for name lookup across nested records and lists', () => {
    const fields = [
      field,
      { key: 'group', type: 'object', fields: [{ key: 'rows', type: 'object_array', fields: [field] }] },
      { key: 'choices', type: 'item_array' },
    ]
    const data = { item: 5, group: { rows: [{ item: { id: 6 } }, {}, { item: 0 }] }, choices: [7, { id: 8 }] }
    expect(collectItemRefIds(fields, data)).toEqual([5, 6, 7, 8])
  })

  it('accepts saved and newly picked references and rejects missing or invalid IDs', () => {
    for (const value of [42, '42', { id: 42 }]) expect(missingRequiredField(field, value)).toBe(false)
    for (const value of [null, {}, { id: 0 }, true, { id: [42] }, -1, 'bad']) expect(missingRequiredField(field, value)).toBe(true)
  })
})
