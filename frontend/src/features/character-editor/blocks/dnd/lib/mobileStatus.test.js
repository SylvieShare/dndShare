import { describe, expect, it } from 'vitest'
import { isInspirationActive } from './mobileStatus'

describe('mobile character status summary', () => {
  it('shows inspiration only for an active boolean or positive legacy count', () => {
    expect(isInspirationActive(true)).toBe(true)
    expect(isInspirationActive(1)).toBe(true)
    expect(isInspirationActive(false)).toBe(false)
    expect(isInspirationActive(0)).toBe(false)
    expect(isInspirationActive(null)).toBe(false)
  })
})
