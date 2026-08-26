import { describe, expect, it } from 'vitest'

import { applyLevelUpSpellSelection } from './levelUpSpellSelection'

describe('level-up class spell selection', () => {
  it('replaces one class list and assigns its source without touching grants or another class', () => {
    const result = applyLevelUpSpellSelection([
      { id: 1, prepared: false },
      { id: 2, spellcasting_source: 'class:wizard:' },
      { id: 3, spellcasting_source: 'class:cleric:' },
      { id: 4, external_only: true, granted_by: [{ item_id: 9 }] },
    ], {
      sourceKey: 'class:wizard:',
      inferUnassigned: true,
      prepares: false,
      entries: [{ id: 2, level: 1 }, { id: 5, level: 2 }],
    })

    expect(result).toEqual([
      { id: 2, prepared: false, spellcasting_source: 'class:wizard:' },
      { id: 3, spellcasting_source: 'class:cleric:' },
      { id: 4, external_only: true, granted_by: [{ item_id: 9 }] },
      { id: 5, prepared: false, spellcasting_source: 'class:wizard:' },
    ])
  })

  it('marks leveled spells prepared for a prepared caster but not cantrips', () => {
    expect(applyLevelUpSpellSelection([], {
      sourceKey: 'class:paladin:', prepares: true,
      entries: [{ id: 10, level: 0 }, { id: 11, level: 1 }],
    })).toEqual([
      { id: 10, prepared: false, spellcasting_source: 'class:paladin:' },
      { id: 11, prepared: true, spellcasting_source: 'class:paladin:' },
    ])
  })

  it('moves spells from the pre-subclass source when an archetype is selected', () => {
    expect(applyLevelUpSpellSelection([
      { id: 20, spellcasting_source: 'class:wizard:' },
    ], {
      sourceKey: 'class:wizard:school',
      sourceAliases: ['class:wizard:'],
      entries: [{ id: 20, level: 1 }],
    })).toEqual([
      { id: 20, prepared: false, spellcasting_source: 'class:wizard:school' },
    ])
  })
})
