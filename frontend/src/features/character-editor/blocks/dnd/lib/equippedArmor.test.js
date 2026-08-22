import { describe, expect, it } from 'vitest'
import { deriveEquippedArmor } from './equippedArmor'

const armor = (id, name, data) => ({ id, name, typeId: 12, data })
const equipped = (...ids) => ({
  equipped: ids.map((item_id, index) => ({ uid: `u${index}`, item_id, count: 1, params: {}, override: null })),
  sections: [],
})

describe('deriveEquippedArmor', () => {
  it('uses the best body armor and shield and preserves a negative Dexterity modifier', () => {
    const items = new Map([
      ['1', armor(1, 'Кожаный доспех', { category: 'light', armor: { ac: 11, use_dex: true } })],
      ['2', armor(2, 'Кольчужная рубаха', { category: 'medium', armor: { ac: 13, use_dex: true, dex_cap: 2 } })],
      ['3', armor(3, 'Щит', { category: 'shield', armor: { shield: true, shield_bonus: 2 } })],
    ])
    const result = deriveEquippedArmor({ DEX: { value: 8 }, items: equipped(1, 2, 3), armor: { bonuses: [{ value: 1 }] } }, items)

    expect(result.body.name).toBe('Кольчужная рубаха')
    expect(result.body.value).toBe(12)
    expect(result.shield.value).toBe(2)
    expect(result.total).toBe(15)
    expect(result.bodyConflict).toBe(true)
    expect(result.byUid.u0.active).toBe(false)
  })

  it('applies stealth and non-proficiency effects only from active equipment', () => {
    const items = {
      1: armor(1, 'Чешуйчатый доспех', {
        category: 'medium', required_armor_proficiency: 20, stealth_disadvantage: true,
        armor: { ac: 14, use_dex: true, dex_cap: 2 },
      }),
    }
    const suggestItems = () => [{ id: 20, value: 'Средние доспехи' }]
    const without = deriveEquippedArmor({ DEX: { value: 14 }, items: equipped(1), proficiencies: { Доспехи: [] } }, items, suggestItems)
    expect(without.total).toBe(16)
    expect(without.stealthDisadvantage).toBe(true)
    expect(without.strengthDexDisadvantage).toBe(true)
    expect(without.castingBlocked).toBe(true)

    const withProficiency = deriveEquippedArmor({ DEX: { value: 14 }, items: equipped(1), proficiencies: { Доспехи: ['Средние доспехи'] } }, items, suggestItems)
    expect(withProficiency.strengthDexDisadvantage).toBe(false)
    expect(withProficiency.castingBlocked).toBe(false)
  })

  it('reduces speed when heavy armor requires more Strength, except for dwarves', () => {
    const items = { 1: armor(1, 'Латы', { category: 'heavy', strength_required: 15, armor: { ac: 18, use_dex: false } }) }
    expect(deriveEquippedArmor({ STR: { value: 10 }, items: equipped(1) }, items).speedPenalty).toBe(10)
    expect(deriveEquippedArmor({ STR: { value: 10 }, race: { name: 'Горный дварф' }, items: equipped(1) }, items).speedPenalty).toBe(0)
  })
})
