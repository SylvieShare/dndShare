import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveStartHp } from './useEncounterNpcs'

afterEach(() => vi.restoreAllMocks())

describe('encounter NPC starting HP', () => {
  const creature = { data: { combat: { hp: 18, hp_formula: '2d8+2' } } }

  it('keeps the handbook average when automatic rolling is disabled', () => {
    expect(resolveStartHp(creature, false)).toEqual({ hp: 18, fromFormula: false })
  })

  it('rolls the formula when automatic rolling is enabled', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    expect(resolveStartHp(creature, true)).toEqual({ hp: 4, fromFormula: true })
  })
})
