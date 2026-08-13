import { describe, expect, it } from 'vitest'
import { isResizeObserverElement, resolveCharacterViewHeight } from './useScrollHide'

class FakeElement {}

describe('character toolbar observation', () => {
  it('accepts an explicit toolbar Element and rejects a Vue fragment anchor', () => {
    expect(isResizeObserverElement(new FakeElement(), FakeElement)).toBe(true)
    expect(isResizeObserverElement({ nodeType: 3 }, FakeElement)).toBe(false)
    expect(isResizeObserverElement(null, FakeElement)).toBe(false)
  })
})

describe('character viewport height', () => {
  it('uses the full viewport on desktop after the desktop header is removed', () => {
    expect(resolveCharacterViewHeight({
      isMobile: false,
      mobileAppHeaderVisible: true,
      headerHidden: false,
      viewportHeight: '900px',
    })).toBe('900px')
  })

  it('subtracts only a visible mobile app header', () => {
    expect(resolveCharacterViewHeight({
      isMobile: true,
      mobileAppHeaderVisible: true,
      headerHidden: false,
      viewportHeight: '800px',
    })).toBe('calc(800px - var(--header-h))')
    expect(resolveCharacterViewHeight({
      isMobile: true,
      mobileAppHeaderVisible: false,
      headerHidden: false,
      viewportHeight: '800px',
    })).toBe('800px')
  })
})
