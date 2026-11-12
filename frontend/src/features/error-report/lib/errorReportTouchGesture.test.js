import { describe, expect, it, vi } from 'vitest'
import { installErrorReportTouchGesture } from './errorReportTouchGesture'

function fixture(canActivate) {
  const target = new EventTarget()
  const view = new EventTarget()
  const activate = vi.fn()
  const dispose = installErrorReportTouchGesture(activate, { target, view, canActivate })
  function send(type, touches = 0, detail = 1) {
    const event = new Event(type, { cancelable: true })
    Object.defineProperties(event, { touches: { value: Array.from({ length: touches }) }, detail: { value: detail } })
    ;(type.startsWith('touch') || type === 'visibilitychange' ? target : view).dispatchEvent(event)
    return event
  }
  return { target, activate, dispose, send }
}

describe('four-finger error report gesture', () => {
  it('leaves one, two and three touch gestures untouched', () => {
    const { activate, dispose, send } = fixture()
    for (let count = 1; count <= 3; count++) {
      expect(send('touchstart', count).defaultPrevented).toBe(false)
      expect(send('touchmove', count).defaultPrevented).toBe(false)
      expect(send('touchend').defaultPrevented).toBe(false)
    }
    expect(activate).not.toHaveBeenCalled()
    dispose()
  })

  it('activates once after every finger is lifted, consuming the gesture', () => {
    const { activate, dispose, send } = fixture()
    expect(send('touchstart', 4).defaultPrevented).toBe(true)
    expect(send('touchstart', 5).defaultPrevented).toBe(true)
    expect(send('touchmove', 5).defaultPrevented).toBe(true)
    for (const remaining of [4, 3, 2, 1]) {
      expect(send('touchend', remaining).defaultPrevented).toBe(true)
      expect(activate).not.toHaveBeenCalled()
    }
    send('touchend')
    expect(activate).toHaveBeenCalledTimes(1)
    send('touchend')
    expect(activate).toHaveBeenCalledTimes(1)
    dispose()
  })

  it('blocks the compatibility click but permits the next intentional tap and keyboard click', () => {
    const { dispose, send } = fixture()
    send('touchstart', 4); send('touchend')
    expect(send('click', 0, 1).defaultPrevented).toBe(true)
    expect(send('click', 0, 0).defaultPrevented).toBe(false)
    send('pointerdown')
    expect(send('click', 0, 1).defaultPrevented).toBe(false)
    dispose()
  })

  it('does not activate after cancellation, focus loss, or hiding the app', () => {
    const { target, activate, dispose, send } = fixture()
    for (const event of ['touchcancel', 'blur', 'visibilitychange']) {
      target.hidden = event === 'visibilitychange'
      send('touchstart', 4); send(event); send('touchend')
    }
    expect(activate).not.toHaveBeenCalled()
    dispose()
  })

  it('keeps an open report unchanged and removes its listeners on disposal', () => {
    const { activate, dispose, send } = fixture(() => false)
    expect(send('touchstart', 4).defaultPrevented).toBe(false)
    send('touchend')
    expect(activate).not.toHaveBeenCalled()
    dispose()
    send('touchstart', 4); send('touchend')
    expect(activate).not.toHaveBeenCalled()
    const enabled = fixture()
    enabled.dispose()
    expect(enabled.send('touchstart', 4).defaultPrevented).toBe(false)
    enabled.send('touchend')
    expect(enabled.activate).not.toHaveBeenCalled()
  })
})
