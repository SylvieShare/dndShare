import { describe, expect, it } from 'vitest'
import { measureMobileTabRects } from './useTabSwipe'

describe('mobile character tab geometry', () => {
  it('measures buttons relative to the scrolled tabbar', () => {
    const tabbar = {
      scrollLeft: 24,
      getBoundingClientRect: () => ({ left: 10 }),
    }
    const buttons = [
      { getBoundingClientRect: () => ({ left: 18, width: 44 }) },
      { getBoundingClientRect: () => ({ left: 70, width: 56 }) },
    ]

    expect(measureMobileTabRects(tabbar, buttons)).toEqual([
      { x: 32, width: 44 },
      { x: 84, width: 56 },
    ])
  })

  it('keeps holes for tabs whose element is not mounted yet', () => {
    const tabbar = {
      scrollLeft: 0,
      getBoundingClientRect: () => ({ left: 5 }),
    }

    expect(measureMobileTabRects(tabbar, [null])).toEqual([null])
  })
})
