import { describe, expect, it } from 'vitest'
import { calculateRichFormula, richFormulaLabel } from './richCalculation'

describe('rich description calculations', () => {
  const context = { casting_mod: { value: 3, label: 'Модификатор: Харизма' }, prof_bonus: { value: 2 } }
  it('evaluates arithmetic precedence, bounds and rounding', () => {
    for (const [formula, value] of [
      ['casting_mod', 3], ['8 + casting_mod + prof_bonus', 13],
      ['5 + casting_mod * 5', 20], ['(casting_mod + prof_bonus) * 2', 10],
      ['max(2, 1 + casting_mod)', 4], ['min(3, casting_mod + prof_bonus)', 3],
      ['floor(5 / 2)', 2], ['ceil(5 / 2)', 3], ['-casting_mod', -3],
    ]) expect(calculateRichFormula(formula, context)).toMatchObject({ value, error: '' })
  })
  it('preserves zero and negative modifiers, applying only an explicit minimum', () => {
    expect(calculateRichFormula('casting_mod', { casting_mod: { value: 0 } }).value).toBe(0)
    const negative = { casting_mod: { value: -2 } }
    expect(calculateRichFormula('casting_mod', negative).value).toBe(-2)
    expect(calculateRichFormula('max(1, casting_mod)', negative).value).toBe(1)
  })
  it('withholds a result when any required character value is unavailable', () => {
    expect(calculateRichFormula('casting_mod')).toMatchObject({ value: null, error: '' })
    expect(calculateRichFormula('max(1, casting_mod)')).toMatchObject({ value: null, error: '' })
    expect(calculateRichFormula('casting_mod + prof_bonus', { casting_mod: { value: 3 } }).value).toBeNull()
    expect(calculateRichFormula('8 + 2').value).toBe(10)
  })
  it('rejects partial expressions, arbitrary code and unbounded input', () => {
    for (const formula of ['', 'foo', 'casting_mod +', '2abc', '2 3', '1 / 0', 'floor(1, 2)',
      'max()', '(1+2', 'casting_mod.value', 'alert(1)', 'globalThis', '1;2', '2 ** 3', '('.repeat(500)]) {
      expect(calculateRichFormula(formula, context).error, formula).toBeTruthy()
    }
  })
  it('uses readable labels and a numeric substitution without losing negative signs', () => {
    expect(richFormulaLabel('casting_mod + prof_bonus', context)).toBe('Модификатор: Харизма + Бонус мастерства')
    expect(richFormulaLabel('2 * casting_mod', { casting_mod: { value: -2 } }, true)).toBe('2 × (-2)')
  })
})
