import { describe, expect, it } from 'vitest'
import { diceById, diceByValue, dieLabel, dieSides, HIT_DICE, SYSTEM_DICE } from './systemDice'

describe('system dice catalogue', () => {
  it('keeps ids equal to the number of sides', () => {
    expect(SYSTEM_DICE.map((die) => die.id)).toEqual([4, 6, 8, 10, 12, 20, 100])
    expect(SYSTEM_DICE.every((die) => die.id === die.sides)).toBe(true)
    expect(HIT_DICE.map((die) => die.value)).toEqual(['d4', 'd6', 'd8', 'd10', 'd12'])
  })

  it('resolves stored ids and hit-die labels without suggests', () => {
    expect(diceById('20')).toMatchObject({ sides: 20, value: 'd20' })
    expect(diceByValue('d100')).toMatchObject({ id: 100, shape: 'd10' })
    expect(dieSides('D8')).toBe(8)
    expect(dieLabel(6)).toBe('d6')
    expect(dieLabel(7)).toBe('')
  })
})
