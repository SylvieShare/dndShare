import { describe, expect, it } from 'vitest'

import { characterChoiceOptionEligibility, characterChoiceTargetRank } from './characterChoiceEligibility'

const suggestItems = (typeId) => typeId === 5 ? [{ id: 18, value: 'Воровские инструменты' }] : []

describe('character-bound choice eligibility', () => {
  it('accepts only owned skills and tools for expertise', () => {
    const context = {
      values: {
        DEX: { skills: { 2: { up: 1 } } },
        proficiencies: { Инструменты: ['Воровские инструменты'] },
      },
      suggestItems,
    }
    const choice = { requires_proficiency: true, exclude_rank: 2 }
    expect(characterChoiceOptionEligibility(choice, 'skill:2', context).eligible).toBe(true)
    expect(characterChoiceOptionEligibility(choice, 'tool:18', context).eligible).toBe(true)
    expect(characterChoiceOptionEligibility(choice, 'skill:9', context).eligible).toBe(false)
  })

  it('excludes a target that already has double proficiency', () => {
    const expertise = { id: 10, name: 'Источник', data: { class_ids: [{ id: 1 }], derived_effects: [
      { kind: 'skill_proficiency', rank: 2, choice_key: 'choice', choice_value_prefix: 'skill', target_from_choice: true },
    ] } }
    const context = {
      values: {
        lvl: { level: 6 }, classes: [{ id: 1, level: 6 }],
        DEX: { skills: { 2: { up: 1 } } },
        abilities_class: [{ id: 10, choices: { choice: ['skill:2'] } }],
      },
      items: [expertise],
      suggestItems,
    }
    expect(characterChoiceTargetRank('skill:2', context)).toBe(2)
    expect(characterChoiceOptionEligibility({ requires_proficiency: true, exclude_rank: 2 }, 'skill:2', context).eligible).toBe(false)
  })
})
