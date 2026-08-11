import { describe, expect, it, vi } from 'vitest'
import { useHandbookSwipeBack } from './useHandbookSwipeBack'

function touchEvent(x, y, overrides = {}) {
  return {
    target: { closest: () => null },
    touches: [{ clientX: x, clientY: y }],
    changedTouches: [{ clientX: x, clientY: y }],
    cancelable: true,
    preventDefault: vi.fn(),
    ...overrides,
  }
}

describe('useHandbookSwipeBack', () => {
  it('goes back after a deliberate horizontal swipe to the right', () => {
    const onBack = vi.fn()
    const swipe = useHandbookSwipeBack(onBack)
    swipe.onTouchStart(touchEvent(20, 100))
    const move = touchEvent(110, 106)
    swipe.onTouchMove(move)
    swipe.onTouchEnd(touchEvent(120, 108, { touches: [] }))

    expect(move.preventDefault).toHaveBeenCalledOnce()
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('leaves vertical scrolling alone', () => {
    const onBack = vi.fn()
    const swipe = useHandbookSwipeBack(onBack)
    swipe.onTouchStart(touchEvent(20, 20))
    const move = touchEvent(26, 100)
    swipe.onTouchMove(move)
    swipe.onTouchEnd(touchEvent(110, 110, { touches: [] }))

    expect(move.preventDefault).not.toHaveBeenCalled()
    expect(onBack).not.toHaveBeenCalled()
  })

  it('does not start on controls or links', () => {
    const onBack = vi.fn()
    const swipe = useHandbookSwipeBack(onBack)
    const controlTarget = { closest: () => ({ tagName: 'BUTTON' }) }
    swipe.onTouchStart(touchEvent(20, 20, { target: controlTarget }))
    swipe.onTouchMove(touchEvent(120, 20))
    swipe.onTouchEnd(touchEvent(140, 20, { touches: [] }))

    expect(onBack).not.toHaveBeenCalled()
  })
})
