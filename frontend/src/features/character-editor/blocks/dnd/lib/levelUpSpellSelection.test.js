import { describe, expect, it } from 'vitest'

import { applyLevelUpSpellSelection } from './levelUpSpellSelection'

describe('applyLevelUpSpellSelection', () => {
  it('replaces only the selected class tab and preserves grants plus duplicate spells in other tabs', () => {
    const book = {
      schema_version: 2, slots_auto: true, slot_pools: { long_rest: [], short_rest: [] },
      tabs: [
        { key: 'wizard', name: 'Волшебник', class_item_id: 1, casting_ability: 4, mode: 'spellbook', save_bonus: 0, attack_bonus: 0, spells: [{ key: 'old', id: 2 }] },
        { key: 'cleric', name: 'Жрец', class_item_id: 2, casting_ability: 5, mode: 'prepared', save_bonus: 0, attack_bonus: 0, spells: [{ key: 'cleric-spell', id: 2 }] },
      ],
      grants: [{ key: 'grant', id: 4, source: { kind: 'ability', item_id: 9 } }],
    }

    const result = applyLevelUpSpellSelection(book, {
      tab: book.tabs[0], entries: [{ id: 2, level: 1, key: 'old' }, { id: 5, level: 1 }],
    })

    expect(result.tabs[0].spells).toEqual([
      { key: 'old', id: 2, prepared: true },
      expect.objectContaining({ id: 5, prepared: true }),
    ])
    expect(result.tabs[1].spells).toEqual([{ key: 'cleric-spell', id: 2, prepared: false }])
    expect(result.grants).toEqual([{ key: 'grant', id: 4, source: { kind: 'ability', item_id: 9 } }])
  })

  it('creates the class tab when a half-caster starts casting', () => {
    const result = applyLevelUpSpellSelection({ slot_pools: {}, tabs: [], grants: [] }, {
      tab: { key: 'paladin', name: 'Паладин', class_item_id: 7, casting_ability: 6, mode: 'prepared', spells: [] },
      entries: [{ id: 10, level: 1 }],
    })
    expect(result.tabs[0]).toMatchObject({ class_item_id: 7, casting_ability: 6, mode: 'prepared' })
    expect(result.tabs[0].spells[0]).toMatchObject({ id: 10, prepared: true })
  })
})
