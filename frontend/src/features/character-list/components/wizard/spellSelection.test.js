import { describe, expect, it } from 'vitest'
import { spellSelectionComplete } from './spellSelection'

describe('wizard spell selection completion', () => {
  it('requires every pick when a class has a non-zero limit', () => {
    expect(spellSelectionComplete(0, 3)).toBe(false)
    expect(spellSelectionComplete(2, 3)).toBe(false)
    expect(spellSelectionComplete(3, 3)).toBe(true)
    expect(spellSelectionComplete(4, 3)).toBe(false)
  })

  it('does not require a choice for prepared spell levels with a zero limit', () => {
    expect(spellSelectionComplete(0, 0)).toBe(true)
  })
})
