import { describe, expect, it } from 'vitest'
import { liveSkillModifier, sourceSkillLabels } from './previewSkills'

const labels = { 1: 'Атлетика', 2: 'Акробатика', 3: 'Обман' }
const labelFor = (id) => labels[id] || ''

describe('sourceSkillLabels', () => {
  it('deduplicates skills within one source and marks its expertise choices', () => {
    expect(sourceSkillLabels({
      proficiencyIds: [1, 2],
      featureIds: ['2'],
      expertiseIds: ['2', 3],
      labelFor,
    })).toEqual(['Атлетика', 'Акробатика (Компетентность)', 'Обман (Компетентность)'])
  })

  it('does not leak expertise from another wizard step', () => {
    const race = sourceSkillLabels({ proficiencyIds: [1], labelFor })
    const charClass = sourceSkillLabels({ expertiseIds: [1], labelFor })

    expect(race).toEqual(['Атлетика'])
    expect(charClass).toEqual(['Атлетика (Компетентность)'])
  })
})

describe('liveSkillModifier', () => {
  it('adds proficiency selected through a feature choice immediately', () => {
    expect(liveSkillModifier({
      abilityMod: 1,
      proficiencyBonus: 2,
      skillId: 3,
      proficiencyIds: ['3'],
    })).toBe(3)
  })

  it('uses twice the proficiency bonus for expertise', () => {
    expect(liveSkillModifier({
      abilityMod: -1,
      proficiencyBonus: 2,
      skillId: 2,
      proficiencyIds: [2],
      expertiseIds: ['2'],
    })).toBe(3)
  })
})
