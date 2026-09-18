import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { useSpellRolls } from './useSpellRolls'
import { rollDiceExpression } from '@/shared/lib/dice'
import { useDiceStore } from '@/stores/dice'
import { spellRollOptions } from '../lib/spellRollOptions'

beforeEach(() => setActivePinia(createPinia()))
function rolls(parts) {
  return useSpellRolls({ charCtx: {}, spellcastingBlocked: ref(false), charLevel: ref(5), damageDiceParts: () => parts, healDiceParts: () => parts })
}
const entry = { item: { id: 1, name: 'Божественное оружие', data: {} } }
describe('spell damage types', () => {
  it('attaches an explosion save only to that stage, never to the attack hit', () => {
    const entry = { item: { id: 599, name: 'Ледяной кинжал', data: {
      damage: { range_attack: true, save_ability: 'dex', save_manual: true },
      rolls: [
        { label: 'Попадание', kind: 'damage', range_attack: true },
        { label: 'Взрыв', kind: 'damage', save_ability: 'dex', save_effect: 'negate', save_condition: 'Независимо от попадания' },
      ],
    } } }
    const spy = vi.spyOn(useDiceStore(), 'roll').mockImplementation(() => {})
    const spell = rolls([{ count: 2, diceLabel: 'd6', type: 'Холод' }])
    const [hit, explosion] = spellRollOptions(entry)
    spell.rollSpellDamage(hit.entry, 1)
    expect(spy.mock.calls[0][2].eventData.savingThrow).toBeUndefined()
    spell.rollSpellDamage(explosion.entry, 1)
    expect(spy.mock.calls[1][2].eventData.savingThrow).toEqual({ ability: 2, dc: 10, onSuccess: 'negate', condition: 'Независимо от попадания', results: [] })
    vi.restoreAllMocks()
  })
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
