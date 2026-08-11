import { describe, expect, it } from 'vitest'
import {
  MOBILE_HEADER_COLLAPSIBLE,
  MOBILE_HEADER_FLOW,
  resolveMobileHeaderMode,
} from './mobileHeader'

describe('mobile app-header mode', () => {
  it('keeps regular pages in natural document flow by default', () => {
    expect(resolveMobileHeaderMode()).toBe(MOBILE_HEADER_FLOW)
    expect(resolveMobileHeaderMode({})).toBe(MOBILE_HEADER_FLOW)
    expect(resolveMobileHeaderMode({ mobileHeader: 'unknown' })).toBe(MOBILE_HEADER_FLOW)
  })

  it('enables programmatic collapse only when the route opts in', () => {
    expect(resolveMobileHeaderMode({ mobileHeader: 'collapsible' })).toBe(MOBILE_HEADER_COLLAPSIBLE)
  })
})
