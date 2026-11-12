import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { usePresetAttacks } from './usePresetAttacks'
import { evaluateDiceParts, parseDiceExpression } from '@/shared/lib/dice'

function fixture(strength, bonus = 0) {
  const dice = { roll: vi.fn(), rollD20: vi.fn(async () => ({ total: 12 })) }
  const ctx = { ownerMode: true, characterDerivedEffects: { bonus: () => ({ total: bonus, contributions: bonus ? [{ source: 'Ярость', value: bonus }] : [] }) } }
  return { dice, preset: usePresetAttacks(ctx, { statsVar: ref({ 1: strength }), profBonus: ref(2), itemMap: ref({}), attackMode: () => 'normal', dice }) }
}

describe('preset damage uses the same sources as its roll', () => {
  it('keeps the fixed hit, rage and strength separate', () => {
    const { preset, dice } = fixture(1, 2)
    const rows = preset.presetMenuSummary('unarmed', {}, 'damage').parts
    expect(rows.map(row => row.source)).toEqual(['Рукопашный удар', 'Ярость', 'Сила'])
    const total = rows.reduce((sum, row) => sum + evaluateDiceParts(parseDiceExpression(row.expression)).total, 0)
    preset.rollPresetDamage('unarmed')
    expect(total).toBe(4)
    expect(dice.roll.mock.calls[0][1]).toBe('4{Дробящий}')
  })
  it('keeps the zero damage floor and critical dice mechanics', () => {
    const { preset, dice } = fixture(-3)
    const rows = preset.presetMenuSummary('unarmed', {}, 'damage').parts
    expect(rows.reduce((sum, row) => sum + evaluateDiceParts(parseDiceExpression(row.expression)).total, 0)).toBe(0)
    preset.rollPresetDamage('improvised', true)
    expect(dice.roll.mock.calls[0][1]).toBe('2d4{Дробящий}-3{Дробящий}')
  })
})
