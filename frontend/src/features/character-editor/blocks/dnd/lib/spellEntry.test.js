import { describe, expect, it } from 'vitest'

import { countsTowardPreparation } from './spellEntry'

describe('countsTowardPreparation', () => {
  it('counts prepared leveled entries in the canonical tab model', () => {
    expect(countsTowardPreparation({ prepared: true }, 1)).toBe(true)
    expect(countsTowardPreparation({ prepared: false }, 1)).toBe(false)
    expect(countsTowardPreparation({ prepared: true }, 0)).toBe(false)
  })
})
