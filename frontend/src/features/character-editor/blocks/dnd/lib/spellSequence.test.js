import { describe, expect, it } from 'vitest'
import { hasSpellSequence, spellSequence } from './spellSequence'

describe('spell sequence snapshot', () => {
  it.each([undefined, {}, { trigger: 'none', unique: 'none' }])('does not start a disabled attack chain: %j', attack_chain => {
    const item = { data: { lvl: 0, damage: {
      range_attack: true, dices: [{ dice_id: 'd10', count: 1 }],
      instances: 1, addon_instances: 1, scaling: 'cantrip', attack_chain,
    } } }
    expect(hasSpellSequence(item)).toBe(false)
    expect(spellSequence(item, { total: 15 }, { castLevel: 0, charLevel: 5 })).toEqual({})
  })

  it.each(['matching_damage', 'matching_dice', 'odd_attack', 'always'])('retains enabled %s chains', trigger => {
    const item = { data: { damage: { attack_chain: { trigger } } } }
    expect(hasSpellSequence(item)).toBe(true)
    expect(spellSequence(item, { total: 15 }, {}).sequence.chain.trigger).toBe(trigger)
  })

  it('still starts a table sequence when chained jumps are disabled', () => {
    const table = { sides: 8, count: 2, source: 'damage' }
    const item = { data: { damage: { roll_table: table, attack_chain: { trigger: 'none' } } } }
    expect(hasSpellSequence(item)).toBe(true)
    expect(spellSequence(item, { total: 15 }, {}).sequence.table).toBe(table)
  })

  it('freezes the cast level formulas and total projectiles for later attacks', () => {
    const item = { data: { lvl: 2, range: { distance: 120 }, damage: { instances: 1, addon_instances: 1, scaling: 'slot', roll_table: { sides: 10 }, attack_chain: { trigger: 'odd_attack' } } } }
    const attack = { total: 14 }
    const result = spellSequence(item, attack, { damageExpression: '3d8', criticalExpression: '6d8', attackBonus: 4, castLevel: 4 })
    expect(result.sequence).toMatchObject({ instances: 3, projectile: 1, revision: 0, damageExpression: '3d8', criticalExpression: '6d8', hits: [{ attack, status: 'target' }] })
    expect(item.data.damage).not.toHaveProperty('hits')
    expect(spellSequence({ data: { damage: { dices: [{}] } } }, attack, {})).toEqual({})
  })
})
