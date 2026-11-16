import { describe, expect, it } from 'vitest'
import { spellMetricRows } from './spellMetricRows'
import { weaponDamageDisplay } from './weaponDamageDisplay'

describe('spell combat metric formulas', () => {
  it('preserves separate types and applies each flat bonus exactly once', () => {
    const rows = spellMetricRows([{ count: 2, diceLabel: 'd8', type: 'Огонь', bonus: 3 }, { count: 1, diceLabel: 'd6', type: 'Холод', bonus: -1 }])
    expect(rows[0].expression).toBe('2d8{Огонь}+3{Огонь}+1d6{Холод}-1{Холод}')
    const groups = weaponDamageDisplay(rows)
    expect(groups.map(group => group.type)).toEqual(['Огонь', 'Холод'])
    expect(groups[0].columns[0].variants[0]).toHaveLength(2)
  })
  it('does not assign a damage type to healing or temporary hit points', () => {
    expect(spellMetricRows([{ count: 1, diceLabel: 'd4', type: 'Лечение', bonus: 3 }], false)[0].expression).toBe('1d4+3')
    expect(spellMetricRows([{ bonus: 5 }], false)[0].expression).toBe('5')
    expect(spellMetricRows([])).toEqual([])
  })
})
