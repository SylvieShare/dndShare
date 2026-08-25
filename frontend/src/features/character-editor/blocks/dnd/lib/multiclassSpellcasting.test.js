import { describe, expect, it } from 'vitest'

import { computeSpellSlotPools, maximumSpellLevelForEntry } from './multiclassSpellcasting'

const items = {
  1: { id: 1, data: { caster_progression: 'full' } },
  2: { id: 2, data: { caster_progression: 'half' } },
  3: { id: 3, data: { caster_progression: 'third' } },
  4: { id: 4, data: { caster_progression: 'pact' } },
  5: { id: 5, data: { caster_progression: 'halfup' } },
}

describe('2014 multiclass spellcasting', () => {
  it('combines ranger 4 and wizard 3 as a fifth-level spellcaster', () => {
    const result = computeSpellSlotPools([{ id: 2, level: 4 }, { id: 1, level: 3 }], items)
    expect(result.casterLevel).toBe(5)
    expect(result.totals.slice(0, 3)).toEqual([4, 3, 2])
  })

  it('rounds each half and third caster down when several Spellcasting classes combine', () => {
    const result = computeSpellSlotPools([{ id: 2, level: 3 }, { id: 3, level: 3 }], items)
    expect(result.casterLevel).toBe(2)
    expect(result.totals.slice(0, 2)).toEqual([3, 0])
  })

  it('keeps a sole half caster on its own class table even beside Pact Magic', () => {
    const result = computeSpellSlotPools([{ id: 2, level: 3 }, { id: 4, level: 1 }], items)
    expect(result.totals.slice(0, 2)).toEqual([3, 0])
    expect(result.pact).toEqual({ count: 1, slotLevel: 1 })
  })

  it('keeps wizard and warlock slots in separate pools', () => {
    const result = computeSpellSlotPools([{ id: 1, level: 3 }, { id: 4, level: 5 }], items)
    expect(result.totals.slice(0, 3)).toEqual([4, 2, 0])
    expect(result.pact).toEqual({ count: 2, slotLevel: 3 })
  })

  it('rounds artificer contribution up and limits spells by class rather than shared slots', () => {
    const result = computeSpellSlotPools([{ id: 5, level: 1 }, { id: 1, level: 1 }], items)
    expect(result.casterLevel).toBe(2)
    expect(maximumSpellLevelForEntry({ id: 5, level: 1 }, items)).toBe(1)
    expect(maximumSpellLevelForEntry({ id: 2, level: 4 }, items)).toBe(1)
    expect(maximumSpellLevelForEntry({ id: 1, level: 3 }, items)).toBe(2)
  })
})
