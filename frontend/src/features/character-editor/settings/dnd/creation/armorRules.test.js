import { describe, expect, it } from 'vitest'
import { armorRuleByName, armorRuleForEquipment, isArmorEquipment } from './armorRules'

describe('armor rules', () => {
  it('recognizes Russian PHB armor names used by text starting equipment', () => {
    expect(armorRuleByName(' Кольчуга ')).toEqual({ ac: 16, use_dex: false })
    expect(armorRuleByName('Кожаная броня')).toEqual({ ac: 11, use_dex: true })
    expect(isArmorEquipment({ name: 'Щит' })).toBe(true)
  })

  it('prefers the structured handbook rule over the name fallback', () => {
    expect(armorRuleForEquipment({
      name: 'Неизвестный доспех',
      armor: { ac: 13, use_dex: true, dex_cap: 1 },
    })).toEqual({ ac: 13, use_dex: true, dex_cap: 1 })
  })
})
