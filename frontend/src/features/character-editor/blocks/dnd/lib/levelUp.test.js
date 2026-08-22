import { describe, expect, it } from 'vitest'

import { casterKindOf, castingAbilityIdOf, computeSlots } from './levelUp'

describe('data-driven caster progression', () => {
  it('does not infer mechanics from class or subclass names', () => {
    const classItem = { nameEn: 'Rogue', data: {} }
    const subclass = { nameEn: 'Something custom', data: { caster_progression: 'third', spellcasting: { ability: 4 } } }
    expect(casterKindOf(classItem, subclass)).toBe('third')
    expect(castingAbilityIdOf(classItem, subclass)).toBe(4)
    expect(computeSlots([{ id: 1, level: 3, subclass: { id: 2 } }], { 1: classItem, 2: subclass }).totals[0]).toBe(2)
  })
})
