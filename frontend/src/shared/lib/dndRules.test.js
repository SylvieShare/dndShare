import { describe, expect, it } from 'vitest'
import { dndRules, originAbilityBonuses } from './dndRules'
import { longRestHp } from '@/features/character-editor/blocks/dnd/lib/rest'
import { itemEditionEligibility } from './itemCompatibility'
describe('independent rules editions', () => {
  it('restores edition-specific hit dice without mutating pools', () => {
    const hp = { max: { base: 30, bonuses: [] }, current: 1, hitDice: [{ die: 'd8', total: 5, used: 5 }] }
    expect(longRestHp(hp, null, '2014').hitDice[0].used).toBe(3)
    expect(longRestHp(hp, null, '2024').hitDice[0].used).toBe(0)
    expect(hp.hitDice[0].used).toBe(5)
  })
  it('derives 2024 exhaustion from the level without accumulating levels', () => {
    expect(dndRules('2024').exhaustionEffects(3)).toMatchObject([{ formula: '-6' }, { value: -15 }])
    expect(dndRules('2024').exhaustionEffects(0)).toEqual([])
  })
  it('checks background ability distributions', () => {
    expect(originAbilityBonuses('2024', ['STR', 'DEX', 'CON'], { STR: 2, CON: 1 })).toHaveLength(2)
    expect(originAbilityBonuses('2024', ['STR', 'DEX', 'CON'], { STR: 3 })).toBeNull()
    expect(originAbilityBonuses('2024', ['STR', 'DEX', 'CON'], { STR: 2, CHA: 1 })).toBeNull()
  })
  it('does not authorize legacy or unreviewed selections', () => {
    const item = { compatibility: [{ sourceVersionId: 1, status: 'native' }, { sourceVersionId: 3, status: 'legacy', replacedByItemId: 42 }] }
    expect(itemEditionEligibility(item, 1).eligible).toBe(true)
    expect(itemEditionEligibility(item, 3).eligible).toBe(false)
    expect(itemEditionEligibility(item, 999).eligible).toBe(false)
  })
})
