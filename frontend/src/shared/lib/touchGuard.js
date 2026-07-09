let _down = false
let _lastTouchEndAt = 0

if (typeof window !== 'undefined') {
  window.addEventListener('touchstart', () => { _down = true }, { passive: true })
  window.addEventListener('touchend', () => { _down = false; _lastTouchEndAt = Date.now() }, { passive: true })
  window.addEventListener('touchcancel', () => { _down = false; _lastTouchEndAt = Date.now() }, { passive: true })
}

export function isTouchActiveOrRecent() {
  return _down || (Date.now() - _lastTouchEndAt < 150)
}
