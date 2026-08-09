import { describe, expect, it } from 'vitest'
import { shouldOpenDropUp } from './dropdownPlacement'

describe('shouldOpenDropUp', () => {
  const boundary = { top: 100, bottom: 700 }

  it('opens upward when the scroll boundary clips the lower menu', () => {
    expect(shouldOpenDropUp({ top: 620, bottom: 655 }, boundary)).toBe(true)
  })

  it('keeps the menu below when enough space remains', () => {
    expect(shouldOpenDropUp({ top: 300, bottom: 335 }, boundary)).toBe(false)
  })

  it('keeps the menu on the side with more visible space', () => {
    expect(shouldOpenDropUp({ top: 115, bottom: 150 }, { top: 100, bottom: 260 })).toBe(false)
  })
})
