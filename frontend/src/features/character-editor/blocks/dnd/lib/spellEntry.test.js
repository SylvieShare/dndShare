import { describe, expect, it } from 'vitest'

import { countsTowardPreparation } from './spellEntry'

describe('countsTowardPreparation', () => {
  it('counts only ordinarily prepared leveled spells', () => {
    expect(countsTowardPreparation({ prepared: true }, 1)).toBe(true)
    expect(countsTowardPreparation({ prepared: false }, 1)).toBe(false)
    expect(countsTowardPreparation({ prepared: true, always_prepared: true }, 1)).toBe(false)
    expect(countsTowardPreparation({ prepared: true }, 0)).toBe(false)
  })
})
