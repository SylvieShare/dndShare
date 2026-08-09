import { describe, expect, it } from 'vitest'

import {
  abilityScoresFromValues,
  choiceSelectionsComplete,
  evaluateFeatEligibility,
  featAbilityBonuses,
  featChoices,
  featEntry,
  featGrantedSpellIds,
  featGrants,
} from './featRules'

describe('featRules', () => {
  it('supports OR ability prerequisites', () => {
    const item = { data: { prereq: { min_stats_mode: 'any', min_stats: [
      { ability: 4, value: 13 },
      { ability: 5, value: 13 },
    ] } } }

    expect(evaluateFeatEligibility(item, { stats: { INT: 10, WIS: 14 } }).eligible).toBe(true)
    expect(evaluateFeatEligibility(item, { stats: { INT: 10, WIS: 12 } })).toMatchObject({
      eligible: false,
      reasons: ['Интеллект 13 или Мудрость 13'],
    })
  })

  it('checks spellcasting, armor and level prerequisites', () => {
    const item = { data: { prereq: { spellcasting: true, armor_prof: [2], min_level: 4 } } }
    expect(evaluateFeatEligibility(item, { spellcasting: false, armorProfIds: [1], level: 3 }).reasons).toHaveLength(3)
    expect(evaluateFeatEligibility(item, { spellcasting: true, armorProfIds: [2], level: 4 }).eligible).toBe(true)
  })

  it('normalizes legacy choice and builds a persistent character entry', () => {
    const item = { id: 7, data: { choice: { count: 1, from_suggest_id: 16 }, max_use: 3 } }
    expect(featChoices(item)[0]).toMatchObject({ key: 'choice_1', source: 'suggest', count: 1 })
    expect(choiceSelectionsComplete(item, { choice_1: [4] })).toBe(true)
    expect(featEntry(item, { choice_1: [4] })).toEqual({ id: 7, count: 3, choices: { choice_1: [4] } })
  })

  it('resolves modern and legacy ability-score shapes', () => {
    expect(abilityScoresFromValues({
      STR: { value: { base: 13, bonuses: [{ value: 2 }] } },
      DEX: { value: 12 },
      CON: 14,
    })).toMatchObject({ STR: 15, DEX: 12, CON: 14 })
  })

  it('combines fixed and selected ability bonuses', () => {
    const item = { data: {
      asi: [{ ability: 4, bonus: 1 }],
      asi_choice: { choice_key: 'ability', bonus: 1 },
    } }
    expect(featAbilityBonuses(item, { ability: [5] })).toEqual([
      { stat: 'INT', bonus: 1 },
      { stat: 'WIS', bonus: 1 },
    ])
  })

  it('applies effects bound to a selected choice', () => {
    const item = { data: {
      choices: [
        { key: 'resilient', from_suggest_id: 16, ability_bonus: 1, grant_proficiency: 'save_prof' },
        { key: 'spells', from_item_type_id: 5, grant_spells: true },
      ],
    } }
    const selected = { resilient: [3], spells: [101, 102] }

    expect(featAbilityBonuses(item, selected)).toEqual([{ stat: 'CON', bonus: 1 }])
    expect(featGrants(item, selected)).toEqual({ save_prof: [3] })
    expect(featGrantedSpellIds(item, selected)).toEqual([101, 102])
  })
})
