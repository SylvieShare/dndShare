import { describe, expect, it } from 'vitest'
import { spellDurationLabel, useSpellCalc } from './useSpellCalc'

function createSpellCalc() {
  return useSpellCalc({
    diceMap: { value: {} },
    diceDetailsMap: { value: {} },
    damageTypeMap: { value: {} },
    damageTypeColorMap: { value: {} },
    schoolMap: { value: {} },
  })
}

describe('spell compact formatting', () => {
  it('removes only leading concentration and ritual markers from the duration', () => {
    expect(spellDurationLabel('Концентрация, до 1 минуты')).toBe('до 1 минуты')
    expect(spellDurationLabel('Ритуал, 1 час')).toBe('1 час')
    expect(spellDurationLabel('до 1 минуты (Концентрация)')).toBe('до 1 минуты (Концентрация)')
  })

})
