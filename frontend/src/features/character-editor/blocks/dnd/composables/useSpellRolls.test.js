import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { useSpellRolls } from './useSpellRolls'
import { rollDiceExpression } from '@/shared/lib/dice'

beforeEach(() => setActivePinia(createPinia()))
function rolls(parts) {
  return useSpellRolls({ charCtx: {}, spellcastingBlocked: ref(false), charLevel: ref(5), damageDiceParts: () => parts, healDiceParts: () => parts })
}
const entry = { item: { id: 1, name: 'Божественное оружие', data: {} } }
describe('spell damage types', () => {
  it('includes the ability modifier in the damage type total', () => {
    const spell = rolls([{ count: 1, diceLabel: 'd8', type: 'Силовое поле', bonus: 3 }])
    const expression = spell.spellDamagePreview(entry, 2)
    expect(expression).toBe('1d8{Силовое поле}+3{Силовое поле}')
    vi.spyOn(Math, 'random').mockReturnValue(0)
    try {
      expect(rollDiceExpression(expression).byType).toEqual([{ label: 'Силовое поле', color: null, value: 4 }])
    } finally { vi.restoreAllMocks() }
    expect(spell.spellDamagePreview(entry, 2, true)).toBe('2d8{Силовое поле}+3{Силовое поле}')
  })
  it('keeps each modifier with its own type and preserves negative bonuses', () => {
    const spell = rolls([{ count: 1, diceLabel: 'd6', type: 'Огонь', bonus: 2 }, { count: 1, diceLabel: 'd4', type: 'Холод', bonus: -1 }])
    expect(spell.spellDamagePreview(entry, 1)).toBe('1d6{Огонь}+2{Огонь}+1d4{Холод}-1{Холод}')
  })
  it('preserves untyped healing and flat-only typed damage', () => {
    const spell = rolls([{ bonus: 5, type: 'Огонь' }])
    expect(spell.spellDamagePreview(entry, 1)).toBe('5{Огонь}')
    expect(spell.spellHealPreview(entry, 1)).toBe('5')
  })
})
