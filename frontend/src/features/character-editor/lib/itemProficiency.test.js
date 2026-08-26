import { describe, expect, it } from 'vitest'
import { hasItemProficiency, itemProficiencyRule } from './itemProficiency'

const suggests = {
  3: [{ id: 9, value: 'Лёгкие доспехи' }],
  4: [{ id: 14, value: 'Простое оружие' }, { id: 24, value: 'Кинжалы' }],
  5: [{ id: 26, value: 'Музыкальные инструменты' }, { id: 322, value: 'Лютня' }],
}
const items = (typeId) => suggests[typeId] || []

describe('item proficiency matching', () => {
  it('matches any concrete or broad linked proficiency', () => {
    const lute = { typeId: 14, data: { required_tool_proficiencies: [322, 26] } }
    expect(hasItemProficiency(lute, { proficiencies: { Инструменты: ['Лютня'] } }, items)).toBe(true)
    expect(hasItemProficiency(lute, { proficiencies: { Инструменты: ['Музыкальные инструменты'] } }, items)).toBe(true)
  })

  it('uses the matching bucket and ignores merely carrying an item', () => {
    const dagger = { typeId: 1, data: { required_weapon_proficiencies: [14, 24] } }
    expect(hasItemProficiency(dagger, { proficiencies: { Оружие: ['КИНЖАЛЫ'] } }, items)).toBe(true)
    expect(hasItemProficiency(dagger, { proficiencies: { Инструменты: ['Кинжалы'] } }, items)).toBe(false)
    expect(hasItemProficiency(dagger, {}, items)).toBe(false)
  })

  it('supports scalar armor requirements', () => {
    const leather = { typeId: 12, data: { required_armor_proficiency: 9 } }
    expect(itemProficiencyRule(leather).bucket).toBe('Доспехи')
    expect(hasItemProficiency(leather, { proficiencies: { Доспехи: ['Лёгкие доспехи'] } }, items)).toBe(true)
  })

  it('accepts a source-owned proficiency without copying it into stored tags', () => {
    const scaleMail = { typeId: 12, data: { required_armor_proficiency: 13 } }
    expect(hasItemProficiency(scaleMail, {}, items, [{ targetId: 13, source: 'Умеренно бронированный' }])).toBe(true)
  })
})
