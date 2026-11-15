import { describe, expect, it } from 'vitest'
import { abilityScoreWithEffects } from './abilityScoreEffects'

describe('temporary ability scores', () => {
  it('changes only the selected score, including values above 20 and negative adjustments', () => {
    const rules = [{ kind: 'ability_bonus', ability_ids: [5], value: 2 }]
    expect(abilityScoreWithEffects(16, 5, rules)).toBe(18)
    expect(abilityScoreWithEffects(20, 5, rules)).toBe(22)
    expect(abilityScoreWithEffects(16, 4, rules)).toBe(16)
    expect(abilityScoreWithEffects(16, 5, [{ ...rules[0], value: -2 }])).toBe(14)
  })
  it('combines bonuses before minimums in either catalogue order', () => {
    const bonus = { kind: 'ability_bonus', ability_ids: [5], value: 2 }
    const minimum = { kind: 'ability_minimum', ability_ids: [5], value: 19 }
    expect(abilityScoreWithEffects(14, 5, [bonus, minimum])).toBe(19)
    expect(abilityScoreWithEffects(14, 5, [minimum, bonus])).toBe(19)
    expect(abilityScoreWithEffects(20, 5, [bonus, minimum])).toBe(22)
  })
})
