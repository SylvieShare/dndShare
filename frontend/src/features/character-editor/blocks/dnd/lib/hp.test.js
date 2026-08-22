import { describe, expect, it } from 'vitest'
import { hpMaximum, normalizeHpMaximum, withHpBase, withHpBonuses } from './hp'

describe('hp maximum', () => {
  it('keeps legacy numeric values compatible', () => {
    expect(normalizeHpMaximum(12)).toEqual({ base: 12, bonuses: [] })
    expect(hpMaximum({ max: 12 })).toBe(12)
  })

  it('adds readonly and manual bonuses to the base', () => {
    expect(hpMaximum({ max: { base: 20, bonuses: [{ value: 3, readonly: true }, { value: -1 }] } })).toBe(22)
  })

  it('updates base and bonuses independently', () => {
    const hp = { max: 10, current: 10 }
    expect(withHpBase(hp, 14).max).toEqual({ base: 14, bonuses: [] })
    expect(withHpBonuses(hp, [{ name: 'Дар', value: 2 }]).max).toEqual({ base: 10, bonuses: [{ name: 'Дар', value: 2 }] })
  })
})
