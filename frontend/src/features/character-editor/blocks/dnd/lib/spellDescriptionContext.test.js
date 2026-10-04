import { describe, expect, it } from 'vitest'
import { spellDescriptionContext } from './spellDescriptionContext'
import { calculateRichFormula } from '@/shared/lib/richCalculation'

const defaults = { entry: { ref: {}, item: { data: { lvl: 1 } } }, values: { lvl: { level: 5 } },
  stats: { 4: 3, 6: -1 }, castingAbility: 4, abilityLabel: 'Интеллект', profBonus: 3, saveDC: 14, attackBonus: 6 }

describe('spell description context', () => {
  it('uses the selected spell source and explicit casting level for an innate spell', () => {
    const wizard = spellDescriptionContext(defaults)
    const innate = spellDescriptionContext({ ...defaults, castingAbility: 6, abilityLabel: 'Харизма',
      entry: { ...defaults.entry, ref: { cast_level: 3, slotless: true } } })
    expect(calculateRichFormula('casting_mod', wizard).value).toBe(3)
    expect(calculateRichFormula('casting_mod', innate).value).toBe(-1)
    expect(innate.cast_level.value).toBe(3)
    expect(wizard).toMatchObject({ char_level: { value: 5 }, spell_dc: { value: 14 }, spell_attack: { value: 6 } })
  })
  it('resolves effective ability scores and preserves missing and zero values', () => {
    const context = spellDescriptionContext({ ...defaults, stats: { 4: 0 },
      values: { DEX: { value: { base: 12, bonuses: [{ value: 2 }] } } } })
    expect(context.dex_mod.value).toBe(2)
    expect(context.casting_mod.value).toBe(0)
    expect(context.wis_mod.value).toBeNull()
    expect(spellDescriptionContext({ ...defaults, castingAbility: '' }).casting_mod.value).toBeNull()
  })
})
