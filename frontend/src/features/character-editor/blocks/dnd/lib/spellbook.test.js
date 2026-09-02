import { describe, expect, it } from 'vitest'

import {
  emptySpellbook,
  findClassSpellTab,
  mergeComputedSlotPools,
  normalizedSpellTabs,
  slotPoolsFromComputation,
  spellTab,
  spellTabFromClass,
  spellbookEntries,
} from './spellbook'

describe('canonical spellbook model', () => {
  it('keeps the same handbook spell as independent tab entries', () => {
    const book = emptySpellbook({ tabs: [
      spellTab({ key: 'wizard', class_item_id: 1, spells: [{ key: 'w-shield', id: 10, prepared: true }] }),
      spellTab({ key: 'cleric', class_item_id: 2, spells: [{ key: 'c-shield', id: 10 }] }),
    ] })

    expect(spellbookEntries(book).map((entry) => [entry.key, entry.id, entry.tab_key])).toEqual([
      ['w-shield', 10, 'wizard'], ['c-shield', 10, 'cleric'],
    ])
  })

  it('finds an automatic tab by its unique base class item', () => {
    const tab = spellTabFromClass({ id: 7, name: 'Паладин' }, { ability: 6, selectionMode: 'prepared' })
    expect(findClassSpellTab([tab], 7)).toBe(tab)
    expect(tab).toMatchObject({ class_item_id: 7, casting_ability: 6, mode: 'prepared' })
  })

  it('keeps only one automatic owner for a base class item', () => {
    expect(normalizedSpellTabs([
      { key: 'first', class_item_id: 7 },
      { key: 'second', class_item_id: 7 },
      { key: 'custom', class_item_id: null },
    ])).toMatchObject([
      { key: 'first', class_item_id: 7 },
      { key: 'second', class_item_id: null },
      { key: 'custom', class_item_id: null },
    ])
  })

  it('converts shared and pact slot results into canonical pools', () => {
    expect(slotPoolsFromComputation({ totals: [3, 2], pact: { count: 2, slotLevel: 3 } })).toEqual({
      long_rest: [{ level: 1, total: 3, used: 0 }, { level: 2, total: 2, used: 0 }],
      short_rest: [{ level: 3, total: 2, used: 0 }],
    })
  })

  it('preserves spent slots while applying new automatic totals', () => {
    expect(mergeComputedSlotPools({ long_rest: [{ level: 1, total: 2, used: 2 }] }, { totals: [3], pact: null }))
      .toEqual({ long_rest: [{ level: 1, total: 3, used: 2 }], short_rest: [] })
  })
})
