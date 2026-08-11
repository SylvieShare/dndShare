import { describe, expect, it } from 'vitest'
import { isResizeObserverElement } from './useScrollHide'

class FakeElement {}

describe('character toolbar observation', () => {
  it('accepts an explicit toolbar Element and rejects a Vue fragment anchor', () => {
    expect(isResizeObserverElement(new FakeElement(), FakeElement)).toBe(true)
    expect(isResizeObserverElement({ nodeType: 3 }, FakeElement)).toBe(false)
    expect(isResizeObserverElement(null, FakeElement)).toBe(false)
  })
})
