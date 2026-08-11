const INTERACTIVE_TARGETS = [
  'a',
  'button',
  'input',
  'select',
  'textarea',
  '[contenteditable="true"]',
  '[data-swipe-back-ignore]',
  '[role="button"]',
].join(',')

export function isHandbookSwipeBackTarget(target) {
  return !target?.closest?.(INTERACTIVE_TARGETS)
}

export function useHandbookSwipeBack(onBack, options = {}) {
  const enabled = options.enabled || (() => true)
  const threshold = options.threshold || 72
  const axisLockDistance = options.axisLockDistance || 10
  let gesture = null

  function reset() {
    gesture = null
  }

  function onTouchStart(event) {
    if (!enabled() || event.touches?.length !== 1 || !isHandbookSwipeBackTarget(event.target)) {
      reset()
      return
    }
    const touch = event.touches[0]
    gesture = { startX: touch.clientX, startY: touch.clientY, x: touch.clientX, y: touch.clientY, horizontal: false }
  }

  function onTouchMove(event) {
    if (!gesture || event.touches?.length !== 1) return
    const touch = event.touches[0]
    gesture.x = touch.clientX
    gesture.y = touch.clientY
    const dx = gesture.x - gesture.startX
    const dy = gesture.y - gesture.startY

    if (!gesture.horizontal && Math.max(Math.abs(dx), Math.abs(dy)) >= axisLockDistance) {
      if (dx <= 0 || Math.abs(dy) >= Math.abs(dx)) {
        reset()
        return
      }
      gesture.horizontal = true
    }

    if (gesture?.horizontal && event.cancelable) event.preventDefault()
  }

  function onTouchEnd(event) {
    if (!gesture) return
    const touch = event.changedTouches?.[0]
    const dx = (touch?.clientX ?? gesture.x) - gesture.startX
    const dy = (touch?.clientY ?? gesture.y) - gesture.startY
    const shouldGoBack = gesture.horizontal
      && dx >= threshold
      && Math.abs(dx) > Math.abs(dy) * 1.25
    reset()
    if (shouldGoBack && enabled()) onBack()
  }

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel: reset,
  }
}
