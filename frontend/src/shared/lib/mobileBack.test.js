import { describe, expect, it, vi } from 'vitest'
import { dispatchMobileHeaderBack, MOBILE_HEADER_BACK_EVENT } from './mobileBack'

describe('mobile header back event', () => {
  it('reports whether a nested screen handled the navigation', () => {
    const dispatchEvent = vi.fn(event => {
      expect(event.type).toBe(MOBILE_HEADER_BACK_EVENT)
      event.preventDefault()
      return false
    })

    expect(dispatchMobileHeaderBack({ dispatchEvent })).toBe(true)
  })
})
