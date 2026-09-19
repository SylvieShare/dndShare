import { describe, expect, it } from 'vitest'
import { spellSequence } from './spellSequence'

describe('spell sequence snapshot', () => {
  it('freezes the cast level formulas and total projectiles for later attacks', () => {
    const item = { data: { lvl: 2, range: { distance: 120 }, damage: { instances: 1, addon_instances: 1, scaling: 'slot', roll_table: { sides: 10 }, attack_chain: { trigger: 'odd_attack' } } } }
    const attack = { total: 14 }
    const result = spellSequence(item, attack, { damageExpression: '3d8', criticalExpression: '6d8', attackBonus: 4, castLevel: 4 })
    expect(result.sequence).toMatchObject({ instances: 3, projectile: 1, revision: 0, damageExpression: '3d8', criticalExpression: '6d8', hits: [{ attack, status: 'target' }] })
    expect(item.data.damage).not.toHaveProperty('hits')
    expect(spellSequence({ data: { damage: { dices: [{}] } } }, attack, {})).toEqual({})
  })
})
