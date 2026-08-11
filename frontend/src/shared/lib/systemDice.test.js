import { describe, expect, it } from 'vitest'
import { diceById, diceByValue, dieLabel, dieSides, HIT_DICE, SYSTEM_DICE } from './systemDice'

describe('system dice catalogue', () => {
  it('keeps ids equal to the number of sides', () => {
    expect(SYSTEM_DICE.map((die) => die.id)).toEqual(['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'])
    expect(SYSTEM_DICE.map((die) => die.legacyId)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(SYSTEM_DICE.map((die) => die.color)).toEqual([
      '#e07b54', '#e0c454', '#7ab8e8', '#a07ae8', '#7ae8a0', '#e87a9f', '#55c9c2',
    ])
    expect(HIT_DICE.map((die) => die.value)).toEqual(['d4', 'd6', 'd8', 'd10', 'd12'])
  })

  it('resolves stored ids and hit-die labels without suggests', () => {
    expect(diceById('d20')).toMatchObject({ sides: 20, value: 'd20' })
    expect(diceByValue('d100')).toMatchObject({ id: 'd100', shape: 'd10' })
    expect(diceByValue(20)).toMatchObject({ id: 'd20', sides: 20 })
    expect(dieSides('D8')).toBe(8)
    expect(dieLabel(6)).toBe('d6')
    expect(dieLabel(7)).toBe('')
  })
})
