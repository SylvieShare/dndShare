import { describe, expect, it } from 'vitest'
import { buildCharacterData } from './buildCharacter'

const selection = (id, name, data = {}) => ({ id, name, item: { id, name, data } })

describe('buildCharacterData skill choices', () => {
  it('records expertise as double proficiency without losing the skill entry', () => {
    const result = buildCharacterData({
      race: selection(1, 'Человек'),
      charClass: selection(2, 'Плут'),
      choices: [{ abilityId: 42, from_suggest_id: 15, expertise: true, selected: [2] }],
      suggestValue: () => '',
    })

    expect(result.data.values.DEX.skills['2']).toMatchObject({ up: 2, override_title: '', bonuses: [] })
    expect(result.data.values.feature_choices['42']).toEqual([2])
  })

  it('keeps regular skill feature choices as normal proficiency', () => {
    const result = buildCharacterData({
      race: selection(1, 'Человек'),
      charClass: selection(2, 'Воин'),
      choices: [{ abilityId: 43, from_suggest_id: 15, selected: [1] }],
      suggestValue: () => '',
    })

    expect(result.data.values.STR.skills['1'].up).toBe(1)
  })
})
