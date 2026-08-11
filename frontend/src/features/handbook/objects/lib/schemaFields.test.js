import { describe, expect, it } from 'vitest'
import { normalizeDataForSave } from './schemaFields'

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
