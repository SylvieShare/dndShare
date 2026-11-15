// Capture the second touch before a canvas can treat it as another edit/drag.
// The complete multi-touch sequence belongs to navigation, including the last finger.
export function installCanvasPinch(host, { enabled = () => true, onStart = () => {}, onChange }) {
  const points = new Map(), listeners = []
  let pinching = false, previous = null, suppressClick = false
  const point = event => ({ clientX: event.clientX, clientY: event.clientY })
  function measure() {
    const [a, b] = [...points.values()]
    if (!a || !b) return null
    return { distance: Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY),
      center: { clientX: (a.clientX + b.clientX) / 2, clientY: (a.clientY + b.clientY) / 2 } }
  }
  function stop(event) { event.preventDefault(); event.stopImmediatePropagation() }
  function listen(target, type, handler) {
    const options = { capture: true, passive: false }
    target.addEventListener(type, handler, options)
    listeners.push(() => target.removeEventListener(type, handler, options))
  }
  function reset() {
    const ids = [...points.keys()]
    points.clear(); previous = null; pinching = false
    for (const id of ids) if (host.hasPointerCapture(id)) host.releasePointerCapture(id)
  }
  listen(host, 'pointerdown', event => {
    if (!points.size) suppressClick = false
    if (event.pointerType !== 'touch' || !enabled()) return
    points.set(event.pointerId, point(event))
    if (points.size < 2 && !pinching) return
    if (!pinching) { pinching = true; suppressClick = true; onStart(event) }
    previous = measure()
    for (const id of points.keys()) host.setPointerCapture(id)
    stop(event)
  })
  listen(host, 'pointermove', event => {
    if (!points.has(event.pointerId)) return
    points.set(event.pointerId, point(event))
    if (!pinching) return
    stop(event)
    if (!enabled()) { reset(); return }
    const current = measure()
    if (current && previous?.distance > 0 && current.distance > 0) {
      onChange({ factor: current.distance / previous.distance, center: current.center, previousCenter: previous.center })
    }
    previous = current
  })
  function end(event) {
    if (!points.has(event.pointerId)) return
    const claimed = pinching
    points.delete(event.pointerId)
    previous = measure()
    if (!points.size) pinching = false
    if (claimed) stop(event)
    if (claimed && host.hasPointerCapture(event.pointerId)) host.releasePointerCapture(event.pointerId)
  }
  listen(host, 'pointerup', end)
  listen(host, 'pointercancel', end)
  const endOutside = event => { if (!host.contains(event.target)) end(event) }
  listen(window, 'pointerup', endOutside)
  listen(window, 'pointercancel', endOutside)
  listen(host, 'lostpointercapture', event => {
    if (points.has(event.pointerId) && !host.hasPointerCapture(event.pointerId)) reset()
  })
  listen(host, 'click', event => { if (suppressClick) stop(event) })
  listen(window, 'blur', event => { if (event.target === window) reset() })
  return () => { listeners.forEach(remove => remove()); reset() }
}
