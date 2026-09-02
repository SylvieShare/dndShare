import { describe, expect, it, vi } from 'vitest'
import { levelUpSessionAdditions } from './levelUpSessionAdditions'

describe('level-up session additions', () => {
  it('finds new abilities, repeatable feats and spells with resolved titles', async () => {
    const loadItems = vi.fn().mockResolvedValue({ items: [{ id: 30, name: 'Туманный шаг' }] })
    const additions = await levelUpSessionAdditions({
      values: {
        abilities_class: [{ id: 10 }],
        abilities_feats: [{ id: 20 }],
        spells: { schema_version: 2, tabs: [], grants: [] },
      },
      updates: {
        abilities_class: [{ id: 10 }, { id: 11 }],
        abilities_feats: [{ id: 20 }, { id: 20 }],
        spells: { schema_version: 2, tabs: [{ key: 'class:1', spells: [{ key: 'spell:30', id: 30 }] }], grants: [] },
      },
      catalogItems: [{ id: 11, name: 'Дополнительная атака' }, { id: 20, name: 'Удачливый' }],
      loadItems,
    })

    expect(additions).toEqual([
      { kind: 'ability', itemId: 11, title: 'Дополнительная атака' },
      { kind: 'feature', itemId: 20, title: 'Удачливый' },
      { kind: 'spell', itemId: 30, title: 'Туманный шаг' },
    ])
    expect(loadItems).toHaveBeenCalledWith([30])
  })

  it('does nothing when level-up added no timeline entries', async () => {
    expect(await levelUpSessionAdditions({ values: {}, updates: {} })).toEqual([])
  })
})
