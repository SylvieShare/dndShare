import { describe, expect, it, vi } from 'vitest'

import { shouldDismissSwipe, useSwipeDismiss } from './useSwipeDismiss'

function target(width = 300) {
  const classes = new Set()
  const styles = new Map()
  return {
    classList: {
      add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)),
      contains: name => classes.has(name),
    },
    style: {
      setProperty: (name, value) => styles.set(name, value),
      removeProperty: name => styles.delete(name),
      getPropertyValue: name => styles.get(name) || '',
    },
    getBoundingClientRect: () => ({ width }),
    setPointerCapture: vi.fn(),
  }
}

function event(overrides = {}) {
  return {
    pointerId: 1,
    pointerType: 'touch',
    isPrimary: true,
    clientX: 0,
    clientY: 0,
    timeStamp: 0,
    target: { closest: () => null },
    preventDefault: vi.fn(),
    ...overrides,
  }
}

describe('swipe dismiss', () => {
  it('requires a deliberate distance or a short fast flick', () => {
    expect(shouldDismissSwipe(20, 300, 300)).toBe(false)
    expect(shouldDismissSwipe(80, 300, 300)).toBe(true)
    expect(shouldDismissSwipe(30, 40, 300)).toBe(true)
  })

  it('dismisses a popup after a horizontal touch swipe', () => {
    const onDismiss = vi.fn()
    const timers = []
    const swipe = useSwipeDismiss({
      onDismiss,
      setTimer: callback => { timers.push(callback); return callback },
      clearTimer: vi.fn(),
    })
    const element = target()

    swipe.onPointerDown(event({ currentTarget: element }), 119)
    const move = event({ currentTarget: element, clientX: 90, timeStamp: 100 })
    swipe.onPointerMove(move)
    swipe.onPointerUp(event({ currentTarget: element, clientX: 90, timeStamp: 140 }))

    expect(move.preventDefault).toHaveBeenCalledOnce()
    expect(element.classList.contains('dice-pop--swipe-dismiss')).toBe(true)
    timers.forEach(callback => callback())
    expect(onDismiss).toHaveBeenCalledWith(119)
  })

  it('leaves vertical scrolling and mouse interaction alone', () => {
    const onDismiss = vi.fn()
    const swipe = useSwipeDismiss({ onDismiss })
    const element = target()

    swipe.onPointerDown(event({ currentTarget: element }), 1)
    const vertical = event({ currentTarget: element, clientX: 4, clientY: 30, timeStamp: 50 })
    swipe.onPointerMove(vertical)
    swipe.onPointerUp(event({ currentTarget: element, clientX: 4, clientY: 30, timeStamp: 80 }))
    swipe.onPointerDown(event({ currentTarget: element, pointerType: 'mouse' }), 2)

    expect(vertical.preventDefault).not.toHaveBeenCalled()
    expect(onDismiss).not.toHaveBeenCalled()
  })
})
