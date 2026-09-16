import { describe, expect, it } from 'vitest'
import { participantDefenses } from './participantDefenses'

function values() {
  return { lvl: { level: 5 }, WIS: { value: 16, skills: { 10: { up: 1 } } }, INT: { value: 14, skills: { 9: { up: 2, bonuses: [{ value: 1 }] } } }, DEX: { value: 14 }, armor: { bonuses: [] } }
}
describe('participant defenses and passive checks', () => {
  it('uses Wisdom perception and Intelligence investigation with proficiency, expertise and manual bonuses', () => {
    const result = participantDefenses(values())
    expect(result.passives.map(row => row.value)).toEqual([16, 19])
    expect(result.armorClass).toBe(12)
  })
  it('adds or subtracts five for the skill mode without rolling dice', () => {
    const v = values()
    v.WIS.skills[10].roll_mode = 'advantage'
    v.INT.skills[9].roll_mode = 'disadvantage'
    expect(participantDefenses(v).passives.map(row => row.value)).toEqual([21, 14])
  })
  it('uses the manual proficiency bonus and supports negative modifiers', () => {
    const v = values()
    v.prof_bonus = { auto: false, v: 4, bonuses: [1] }
    v.WIS.value = 8
    expect(participantDefenses(v).passives.map(row => row.value)).toEqual([14, 23])
  })
  it('uses equipped armor and a shield instead of the unarmored estimate', () => {
    const v = values()
    v.items = { equipped: [{ uid: 'mail', item_id: 1 }, { uid: 'shield', item_id: 2 }] }
    const items = new Map([
      ['1', { id: 1, typeId: 12, data: { armor: { ac: 16, use_dex: false } } }],
      ['2', { id: 2, typeId: 12, data: { armor: { shield: true, shield_bonus: 2 } } }],
    ])
    expect(participantDefenses(v, items).armorClass).toBe(18)
  })
  it('uses derived expertise and bonuses, and cancels opposing modes', () => {
    const v = values()
    v.abilities_class = [{ id: 1 }]
    const items = new Map([['1', { id: 1, data: { derived_effects: [
      { kind: 'skill_proficiency', skill_ids: [10], rank: 2 },
      { kind: 'skill_bonus', skill_ids: [10], value: 2 },
      { kind: 'roll_mode', skill_ids: [10], mode: 'advantage' },
      { kind: 'roll_mode', skill_ids: [10], mode: 'disadvantage' },
    ] } }]])
    expect(participantDefenses(v, items).passives[0]).toMatchObject({ value: 21, mode: 'normal' })
    v.WIS.skills[10].roll_mode = 'advantage'
    expect(participantDefenses(v, items).passives[0].value).toBe(26)
  })
})
