import { describe, expect, it } from 'vitest'
import {
  statusDuration,
  statusMechanicsLabel,
  statusRulePresentation,
  statusThesisLines,
} from './statusEffectPresentation'

describe('status effect presentation', () => {
  it('formats catalogue durations in natural Russian', () => {
    expect(statusDuration({ kind: 'minutes', value: 1 })).toBe('1 минута')
    expect(statusDuration({ kind: 'rounds', value: 3 })).toBe('3 раунда')
    expect(statusDuration({ kind: 'hours', value: 12 })).toBe('12 часов')
    expect(statusDuration({ kind: 'permanent' })).toBe('Постоянно')
  })

  it('describes a targeted ability-based weapon bonus without exposing storage keys', () => {
    expect(statusRulePresentation({
      kind: 'weapon_attack_bonus',
      ability_modifier: 6,
      minimum: 1,
      target_parameter: 'weapon_uid',
      label: 'Священное оружие',
    })).toEqual({
      title: 'Атаки оружием',
      value: 'Модификатор: Харизма',
      note: 'минимум +1 · только выбранная цель · Священное оружие',
    })
  })

  it('normalizes thesis bullets and summarizes structured mechanics', () => {
    expect(statusThesisLines('- Первый тезис\n• Второй тезис')).toEqual(['Первый тезис', 'Второй тезис'])
    expect(statusMechanicsLabel({ derived_effects: [{}, {}], defenses: [{}] })).toBe('3 правила')
    expect(statusMechanicsLabel({})).toBe('Описательный эффект')
  })
})
