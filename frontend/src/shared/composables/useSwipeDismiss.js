export const SWIPE_DISMISS_MIN_DISTANCE = 64
export const SWIPE_DISMISS_MAX_DISTANCE = 96
export const SWIPE_DISMISS_MIN_VELOCITY = 0.6

export function shouldDismissSwipe(deltaX, elapsedMs, width) {
  const distance = Math.abs(deltaX)
  const threshold = Math.min(
    SWIPE_DISMISS_MAX_DISTANCE,
    Math.max(SWIPE_DISMISS_MIN_DISTANCE, width * 0.24),
  )
  const velocity = distance / Math.max(elapsedMs, 1)
  return distance >= threshold || (distance >= 24 && velocity >= SWIPE_DISMISS_MIN_VELOCITY)
}

export function useSwipeDismiss({ onDismiss, setTimer = setTimeout, clearTimer = clearTimeout }) {
  const pointers = new Map()
  const timers = new Set()

  function clearSwipeStyles(target) {
    target.classList.remove('dice-pop--swiping', 'dice-pop--swipe-dismiss')
    target.style.removeProperty('--dice-swipe-x')
    target.style.removeProperty('--dice-swipe-opacity')
  }

  function schedule(callback, delay) {
    const timer = setTimer(() => {
      timers.delete(timer)
      callback()
    }, delay)
    timers.add(timer)
  }

  function reset(pointer, animated = true) {
    const { target } = pointer
    target.classList.remove('dice-pop--swiping')
    if (!animated) {
      clearSwipeStyles(target)
      return
    }
    target.style.setProperty('--dice-swipe-x', '0px')
    target.style.setProperty('--dice-swipe-opacity', '1')
    schedule(() => clearSwipeStyles(target), 180)
  }

  function onPointerDown(event, id) {
    if (event.pointerType === 'mouse' || event.isPrimary === false) return
    if (event.target.closest('button, a, input, textarea, select, [role="button"]')) return
    const target = event.currentTarget
    target.setPointerCapture?.(event.pointerId)
    target.classList.add('dice-pop--swiping')
    pointers.set(event.pointerId, {
      id,
      target,
      startX: event.clientX,
      startY: event.clientY,
      startedAt: event.timeStamp,
      deltaX: 0,
      horizontal: false,
    })
  }

  function onPointerMove(event) {
    const pointer = pointers.get(event.pointerId)
    if (!pointer) return
    const deltaX = event.clientX - pointer.startX
    const deltaY = event.clientY - pointer.startY
    if (!pointer.horizontal && Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 8) {
      pointers.delete(event.pointerId)
      reset(pointer, false)
      return
    }
    if (Math.abs(deltaX) <= 8) return
    pointer.horizontal = true
    pointer.deltaX = deltaX
    event.preventDefault()
    const width = pointer.target.getBoundingClientRect().width || 1
    const opacity = Math.max(0.28, 1 - Math.abs(deltaX) / (width * 1.15))
    pointer.target.style.setProperty('--dice-swipe-x', `${deltaX}px`)
    pointer.target.style.setProperty('--dice-swipe-opacity', String(opacity))
  }

  function onPointerUp(event) {
    const pointer = pointers.get(event.pointerId)
    if (!pointer) return
    pointers.delete(event.pointerId)
    const width = pointer.target.getBoundingClientRect().width || 1
    const elapsed = event.timeStamp - pointer.startedAt
    if (!pointer.horizontal || !shouldDismissSwipe(pointer.deltaX, elapsed, width)) {
      reset(pointer)
      return
    }
    const direction = pointer.deltaX < 0 ? -1 : 1
    pointer.target.classList.remove('dice-pop--swiping')
    pointer.target.classList.add('dice-pop--swipe-dismiss')
    pointer.target.style.setProperty('--dice-swipe-x', `${direction * (width + 48)}px`)
    pointer.target.style.setProperty('--dice-swipe-opacity', '0')
    schedule(() => onDismiss(pointer.id), 160)
  }

  function onPointerCancel(event) {
    const pointer = pointers.get(event.pointerId)
    if (!pointer) return
    pointers.delete(event.pointerId)
    reset(pointer)
  }

  function dispose() {
    pointers.forEach(pointer => clearSwipeStyles(pointer.target))
    pointers.clear()
    timers.forEach(clearTimer)
    timers.clear()
  }

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, dispose }
}
