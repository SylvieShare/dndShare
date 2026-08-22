import { describe, expect, it } from 'vitest'
import {
  collectCharacterDerivedEffects,
  derivedArmorRules,
  derivedCriticalThreshold,
  derivedNumericBonus,
  derivedProficiency,
  derivedSpeedBonuses,
} from './characterDerivedEffects'

const items = new Map([
  ['1', { id: 1, name: 'Защита без доспехов', data: { class_ids: [{ id: 10 }], derived_effects: [
    { kind: 'armor_formula', base: 10, ability_ids: [2, 5] },
    { kind: 'speed_bonus', group: 'unarmored', value: 10, level: 2 },
    { kind: 'speed_bonus', group: 'unarmored', value: 15, level: 6 },
  ] } }],
  ['2', { id: 2, name: 'Компетентность', data: { class_ids: [{ id: 10 }], derived_effects: [
    { kind: 'skill_proficiency', rank: 2, choice_key: 'skills', target_from_choice: true },
  ] } }],
  ['3', { id: 3, name: 'Чемпион', data: { class_ids: [{ id: 10 }], derived_effects: [
    { kind: 'critical_threshold', value: 19, level: 3 },
    { kind: 'critical_threshold', value: 18, level: 15 },
  ] } }],
])

function values(level = 6) {
  return {
    lvl: { level },
    classes: [{ id: 10, level }],
    prof_bonus: { auto: true, bonuses: [] },
    abilities_class: [{ id: 1 }, { id: 2, choices: { skills: [7] } }, { id: 3 }],
  }
}

describe('class-derived effects', () => {
  it('uses the highest row in a scaling speed group', () => {
    const effects = collectCharacterDerivedEffects(values(), items)
    expect(derivedSpeedBonuses(effects).total).toBe(15)
    expect(derivedArmorRules(effects).formulas[0]).toMatchObject({ base: 10, ability_ids: [2, 5] })
  })

  it('targets proficiency through the stored ability choice', () => {
    const effects = collectCharacterDerivedEffects(values(), items)
    expect(derivedProficiency(effects, 'skill_proficiency', { kind: 'skill_check', skillId: 7 }).rank).toBe(2)
    expect(derivedProficiency(effects, 'skill_proficiency', { kind: 'skill_check', skillId: 8 }).rank).toBe(0)
  })

  it('selects the best unlocked critical threshold', () => {
    expect(derivedCriticalThreshold(collectCharacterDerivedEffects(values(6), items), { kind: 'attack' })).toBe(19)
    expect(derivedCriticalThreshold(collectCharacterDerivedEffects(values(15), items), { kind: 'attack' })).toBe(18)
  })

  it('can derive a half-proficiency bonus without mutating sheet data', () => {
    const effect = [{ kind: 'check_bonus', proficiency_multiplier: 0.5, source_entry: {} }]
    expect(derivedNumericBonus(effect, 'check_bonus', values(9), { kind: 'ability_check', proficient: false }).total).toBe(2)
  })
})
