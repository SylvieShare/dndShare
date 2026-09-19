import { expect, it } from 'vitest'
import { richDiceColor } from './richDiceColor'

const potion = { data: { usable: { healing: '2d4 + 2', temporary_hp: '1d6' } } }
it('colors healing and temporary HP even with localized dice notation', () => {
  expect(richDiceColor('2к4 + 2', potion)).toBe('var(--success)')
  expect(richDiceColor('d6', potion)).toBe('var(--info)')
})
it('leaves other formulas and explicitly typed damage unchanged', () => {
  expect(richDiceColor('1d4', potion)).toBeNull()
  expect(richDiceColor('2d4{огонь|var(--danger)} + 2', potion)).toBeNull()
  expect(richDiceColor('2d4 + 2', null)).toBeNull()
  expect(richDiceColor('', potion)).toBeNull()
})
