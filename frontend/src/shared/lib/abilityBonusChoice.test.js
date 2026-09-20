import { describe, expect, it } from 'vitest'
import { normalizeBonusSelection, toggleBonusSelection, validBonusSelection } from './abilityBonusChoice'

const allowed = ['STR', 'DEX', 'CON']
describe('ability bonus choices', () => {
  it('keeps Soldier within +2/+1 and prevents doubling the same ability', () => {
    const first = toggleBonusSelection({}, 'STR', 2, allowed, [2, 1])
    expect(toggleBonusSelection(first, 'DEX', 2, allowed, [2, 1])).toBe(first)
    expect(toggleBonusSelection(first, 'STR', 1, allowed, [2, 1])).toBe(first)
    const complete = toggleBonusSelection(first, 'CON', 1, allowed, [2, 1])
    expect(complete).toEqual({ STR: 2, CON: 1 })
    expect(toggleBonusSelection(complete, 'DEX', 1, allowed, [2, 1])).toBe(complete)
    expect(toggleBonusSelection(complete, 'STR', 2, allowed, [2, 1])).toEqual({ CON: 1 })
  })
  it('supports both equal racial bonuses and three origin bonuses', () => {
    expect(validBonusSelection({ STR: 1, DEX: 1 }, allowed, [1, 1])).toBe(true)
    expect(validBonusSelection({ STR: 1, DEX: 1, CON: 1 }, allowed, [1, 1])).toBe(false)
    expect(validBonusSelection({ STR: 1, DEX: 1, CON: 1 }, allowed, [1, 1, 1])).toBe(true)
  })
  it('cleans invalid drafts and excludes abilities absent from the new background', () => {
    expect(normalizeBonusSelection({ STR: 2, DEX: 2, CON: 1, CHA: 1 }, allowed, [2, 1])).toEqual({ STR: 2, CON: 1 })
    expect(normalizeBonusSelection({ STR: 2, WIS: 1 }, ['DEX', 'INT', 'WIS'], [2, 1])).toEqual({ WIS: 1 })
    expect(validBonusSelection({ OTHER: 1 }, ['OTHER'], [1])).toBe(false)
  })
})
