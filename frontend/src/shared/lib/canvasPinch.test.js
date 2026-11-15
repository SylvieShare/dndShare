import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installCanvasPinch } from './canvasPinch'
class Host extends EventTarget {
  contains(node) { return node === this }
  captured = new Set()
  setPointerCapture(id) { this.captured.add(id) }
  hasPointerCapture(id) { return this.captured.has(id) }
  releasePointerCapture(id) { this.captured.delete(id) }
}
const send = (host, type, id, x = 0, y = 0, pointerType = 'touch') => {
  const event = Object.assign(new Event(type, { cancelable: true }), { pointerId: id, clientX: x, clientY: y, pointerType })
  host.dispatchEvent(event)
  return event
}
beforeEach(() => vi.stubGlobal('window', new EventTarget()))
afterEach(() => vi.unstubAllGlobals())
describe('canvas pinch ownership', () => {
  it('takes the second touch, reports distance and midpoint, and keeps the last finger from editing', () => {
    const host = new Host(), changes = [], onStart = vi.fn(), edit = vi.fn()
    const dispose = installCanvasPinch(host, { onStart, onChange: change => changes.push(change) })
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'click']) host.addEventListener(type, edit)
    expect(send(host, 'pointerdown', 1, 0, 10).defaultPrevented).toBe(false)
    expect(edit).toHaveBeenCalledTimes(1)
    const focusBlur = new Event('blur')
    Object.defineProperty(focusBlur, 'target', { value: host })
    window.dispatchEvent(focusBlur) // focusing the canvas must not cancel its first finger
    expect(send(host, 'pointerdown', 2, 100, 10).defaultPrevented).toBe(true)
    expect(onStart).toHaveBeenCalledOnce()
    expect(host.captured).toEqual(new Set([1, 2]))
    send(host, 'pointermove', 2, 200, 30)
    expect(changes[0].factor).toBeCloseTo(Math.hypot(200, 20) / 100)
    expect(changes[0].previousCenter).toEqual({ clientX: 50, clientY: 10 })
    expect(changes[0].center).toEqual({ clientX: 100, clientY: 20 })
    send(host, 'pointerup', 2)
    expect(send(host, 'pointermove', 1, 30, 30).defaultPrevented).toBe(true)
    expect(changes).toHaveLength(1)
    send(host, 'pointerup', 1)
    expect(host.captured.size).toBe(0)
    expect(send(host, 'click', 1).defaultPrevented).toBe(true)
    expect(edit).toHaveBeenCalledTimes(1)
    send(host, 'pointerdown', 9, 0, 0, 'mouse'); send(host, 'pointerup', 9, 0, 0, 'mouse'); send(host, 'click', 9, 0, 0, 'mouse')
    expect(edit).toHaveBeenCalledTimes(4)
    send(host, 'pointerdown', 3); send(host, 'pointerup', 3); send(host, 'click', 3)
    expect(edit).toHaveBeenCalledTimes(7)
    dispose()
  })
  it('ignores mouse input and disabled canvases', () => {
    const host = new Host(), onStart = vi.fn(), onChange = vi.fn()
    const dispose = installCanvasPinch(host, { enabled: () => false, onStart, onChange })
    send(host, 'pointerdown', 1); send(host, 'pointerdown', 2); send(host, 'pointermove', 2, 100)
    expect(onStart).not.toHaveBeenCalled(); expect(onChange).not.toHaveBeenCalled()
    dispose()
    const stop = installCanvasPinch(host, { onStart, onChange })
    send(host, 'pointerdown', 1, 0, 0, 'mouse'); send(host, 'pointerdown', 2, 100, 0, 'mouse')
    expect(onStart).not.toHaveBeenCalled()
    stop()
  })
  it('cancels on blur, capture loss and disposal and can begin again', () => {
    const host = new Host(), onStart = vi.fn(), onChange = vi.fn()
    const dispose = installCanvasPinch(host, { onStart, onChange })
    send(host, 'pointerdown', 1); send(host, 'pointerdown', 2, 100)
    window.dispatchEvent(new Event('blur')); expect(host.captured.size).toBe(0)
    send(host, 'pointerdown', 3); send(host, 'pointerdown', 4, 100)
    host.releasePointerCapture(3); send(host, 'lostpointercapture', 3)
    expect(host.captured.size).toBe(0)
    send(host, 'pointerdown', 5); send(host, 'pointerdown', 6, 100)
    expect(onStart).toHaveBeenCalledTimes(3)
    dispose()
    send(host, 'pointerdown', 7); send(host, 'pointerdown', 8, 100); send(host, 'pointermove', 8, 200)
    expect(onStart).toHaveBeenCalledTimes(3); expect(onChange).not.toHaveBeenCalled()
    expect(host.captured.size).toBe(0)
  })
  it('handles cancellation and zero-distance pairs without invalid zoom factors', () => {
    const host = new Host(), onChange = vi.fn()
    const dispose = installCanvasPinch(host, { onChange })
    send(host, 'pointerdown', 1); send(host, 'pointerdown', 2); send(host, 'pointermove', 2)
    expect(onChange).not.toHaveBeenCalled()
    send(host, 'pointercancel', 1); send(host, 'pointercancel', 2)
    send(host, 'pointerdown', 3); send(host, 'pointerdown', 4, 100); send(host, 'pointermove', 4, 50)
    expect(onChange.mock.calls[0][0].factor).toBe(.5)
    dispose()
  })
  it('does not retain a first touch released outside an uncaptured canvas child', () => {
    const host = new Host(), onStart = vi.fn()
    const dispose = installCanvasPinch(host, { onStart, onChange: vi.fn() })
    send(host, 'pointerdown', 1)
    send(window, 'pointerup', 1)
    send(host, 'pointerdown', 2)
    expect(onStart).not.toHaveBeenCalled()
    send(host, 'pointerdown', 3, 100)
    expect(onStart).toHaveBeenCalledOnce()
    dispose()
  })
})
