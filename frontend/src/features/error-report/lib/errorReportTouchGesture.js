// Keep the activating touches separate from the next tap that selects an element.
export function installErrorReportTouchGesture(onActivate, {
  canActivate = () => true,
  target = document,
  view = window,
} = {}) {
  let armed = false
  let blockCompatibilityClick = false
  const touchOptions = { capture: true, passive: false }
  const captureOptions = { capture: true }

  function consume(event) {
    if (event.cancelable) event.preventDefault()
    event.stopImmediatePropagation()
  }

  function reset() {
    armed = false
    blockCompatibilityClick = false
  }

  function onStart(event) {
    if (!armed && event.touches.length >= 4 && canActivate()) armed = true
    if (armed) consume(event)
  }

  function onMove(event) {
    if (armed) consume(event)
  }

  function onEnd(event) {
    if (!armed) return
    consume(event)
    if (event.touches.length) return
    armed = false
    blockCompatibilityClick = true
    if (canActivate()) onActivate()
  }

  function onCancel(event) {
    if (!armed) return
    consume(event)
    armed = false
    blockCompatibilityClick = true
  }

  function onPointerDown() {
    if (!armed) blockCompatibilityClick = false
  }

  function onClick(event) {
    if (blockCompatibilityClick && event.detail > 0) consume(event)
  }

  function onVisibilityChange() {
    if (target.hidden) reset()
  }

  target.addEventListener('touchstart', onStart, touchOptions)
  target.addEventListener('touchmove', onMove, touchOptions)
  target.addEventListener('touchend', onEnd, touchOptions)
  target.addEventListener('touchcancel', onCancel, touchOptions)
  target.addEventListener('visibilitychange', onVisibilityChange)
  view.addEventListener('pointerdown', onPointerDown, captureOptions)
  view.addEventListener('click', onClick, captureOptions)
  view.addEventListener('blur', reset)

  return () => {
    reset()
    target.removeEventListener('touchstart', onStart, touchOptions)
    target.removeEventListener('touchmove', onMove, touchOptions)
    target.removeEventListener('touchend', onEnd, touchOptions)
    target.removeEventListener('touchcancel', onCancel, touchOptions)
    target.removeEventListener('visibilitychange', onVisibilityChange)
    view.removeEventListener('pointerdown', onPointerDown, captureOptions)
    view.removeEventListener('click', onClick, captureOptions)
    view.removeEventListener('blur', reset)
  }
}
