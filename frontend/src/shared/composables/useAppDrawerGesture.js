import { onBeforeUnmount, onMounted } from 'vue'

// Reserve the first 24px for the app drawer; gestures inside a page keep their own meaning.
export function useAppDrawerGesture(enabled, open) {
  let gesture = null
  function start(event) {
    gesture = null
    const touch = event.touches?.[0]
    if (!enabled() || event.touches.length !== 1 || touch.clientX > 24
      || event.target.closest?.('button, a, input, textarea, select, [role="dialog"], [contenteditable="true"]')
      || document.querySelector('[aria-modal="true"]')) return
    gesture = { x: touch.clientX, y: touch.clientY }
    event.stopPropagation()
  }
  function move(event) {
    if (!gesture || event.touches.length !== 1) return
    const touch = event.touches[0]
    const dx = touch.clientX - gesture.x
    const dy = touch.clientY - gesture.y
    if (Math.abs(dy) > 12 && Math.abs(dy) >= Math.abs(dx)) { gesture = null; return }
    if (dx > 12 && dx > Math.abs(dy) * 1.25) {
      if (event.cancelable) event.preventDefault()
      event.stopPropagation()
      if (dx >= 64) { gesture = null; open() }
    }
  }
  function reset() { gesture = null }
  onMounted(() => {
    window.addEventListener('touchstart', start, { capture: true, passive: true })
    window.addEventListener('touchmove', move, { capture: true, passive: false })
    window.addEventListener('touchend', reset, true)
    window.addEventListener('touchcancel', reset, true)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('touchstart', start, true)
    window.removeEventListener('touchmove', move, true)
    window.removeEventListener('touchend', reset, true)
    window.removeEventListener('touchcancel', reset, true)
  })
}
