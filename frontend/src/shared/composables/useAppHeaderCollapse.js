import { computed, getCurrentScope, onScopeDispose, watch } from 'vue'
import { useUiStore } from '@/stores/ui'

const DEFAULT_THRESHOLD = 10
const DEFAULT_SETTLE_MS = 120

export function isAppHeaderScrollSource(source, windowObject, ElementClass) {
  if (!source) return false
  if (windowObject && source === windowObject) return true
  if (ElementClass) return source instanceof ElementClass
  return typeof source.scrollTop === 'number' && typeof source.addEventListener === 'function'
}

// One collapsible app-header controller can follow either window or a page-owned scroll element.
// Regular pages use the route's `flow` mode and need no controller; fullscreen workspaces register
// their active nested scroller here.
export function useAppHeaderCollapse(enabled, options = {}) {
  const uiStore = useUiStore()
  const threshold = options.threshold ?? DEFAULT_THRESHOLD
  const settleMs = options.settleMs ?? DEFAULT_SETTLE_MS
  const windowObject = options.windowObject ?? (typeof window !== 'undefined' ? window : null)
  const ElementClass = options.ElementClass ?? (typeof Element !== 'undefined' ? Element : null)
  const onPosition = options.onPosition || (() => {})
  const onSettled = options.onSettled || (() => {})

  const headerHidden = computed(() => uiStore.headerHidden)
  let scrollSource = null
  let lastScrollY = 0
  let touchLastY = null
  let settleTimer = null

  function sourceScrollY(source = scrollSource) {
    if (!source) return 0
    if (windowObject && source === windowObject) return Number(windowObject.scrollY) || 0
    return Number(source.scrollTop) || 0
  }

  function clearSettle() {
    clearTimeout(settleTimer)
    settleTimer = null
  }

  function settle() {
    settleTimer = null
    const y = sourceScrollY()
    const hidden = !!enabled.value && y > threshold
    uiStore.setHeaderHidden(hidden)
    onSettled({ y, hidden })
  }

  function scheduleSettle() {
    clearSettle()
    settleTimer = setTimeout(settle, settleMs)
  }

  function onScroll() {
    if (!scrollSource) return
    const y = sourceScrollY()
    const delta = y - lastScrollY
    lastScrollY = y
    uiStore.setScrollY(y)
    onPosition({ y, delta })

    if (y <= threshold) {
      clearSettle()
      uiStore.setHeaderHidden(false)
      return
    }

    // A fullscreen route may still use this controller as its single nested-scroll
    // observer while keeping the app header disabled. Settling remains useful to
    // feature chrome, but must never hide the header.
    if (!enabled.value) uiStore.setHeaderHidden(false)
    scheduleSettle()
  }

  function onTouchStart(event) {
    touchLastY = event.touches?.[0]?.clientY ?? null
  }

  function onTouchMove(event) {
    const y = event.touches?.[0]?.clientY
    if (touchLastY == null || y == null || !scrollSource) return
    const fingerDelta = y - touchLastY
    if (sourceScrollY() <= 0 && fingerDelta > 6) {
      clearSettle()
      uiStore.setHeaderHidden(false)
    }
    touchLastY = y
  }

  function onTouchEnd() {
    touchLastY = null
  }

  function addListeners(source) {
    source.addEventListener('scroll', onScroll, { passive: true })
    source.addEventListener('touchstart', onTouchStart, { passive: true })
    source.addEventListener('touchmove', onTouchMove, { passive: true })
    source.addEventListener('touchend', onTouchEnd, { passive: true })
    source.addEventListener('touchcancel', onTouchEnd, { passive: true })
  }

  function removeListeners(source) {
    source?.removeEventListener('scroll', onScroll)
    source?.removeEventListener('touchstart', onTouchStart)
    source?.removeEventListener('touchmove', onTouchMove)
    source?.removeEventListener('touchend', onTouchEnd)
    source?.removeEventListener('touchcancel', onTouchEnd)
  }

  function syncInitialState({ preserveHidden = false } = {}) {
    const y = sourceScrollY()
    lastScrollY = y
    uiStore.setScrollY(y)
    const hidden = !!enabled.value && (y > threshold || (preserveHidden && uiStore.headerHidden))
    uiStore.setHeaderHidden(hidden)
    onPosition({ y, delta: 0, initial: true })
  }

  function startScrollSource(source, startOptions = {}) {
    if (!isAppHeaderScrollSource(source, windowObject, ElementClass)) {
      stopScrollSource()
      return false
    }
    clearSettle()
    if (scrollSource !== source) {
      removeListeners(scrollSource)
      scrollSource = source
      addListeners(scrollSource)
    }
    syncInitialState(startOptions)
    return true
  }

  function stopScrollSource() {
    clearSettle()
    removeListeners(scrollSource)
    scrollSource = null
    lastScrollY = 0
    touchLastY = null
    uiStore.setScrollY(0)
    uiStore.setHeaderHidden(false)
  }

  function revealHeader() {
    clearSettle()
    uiStore.setHeaderHidden(false)
  }

  const stopEnabledWatch = watch(enabled, () => {
    if (scrollSource) syncInitialState()
    else if (!enabled.value) uiStore.setHeaderHidden(false)
  })

  function dispose() {
    stopEnabledWatch()
    stopScrollSource()
  }

  if (getCurrentScope()) onScopeDispose(dispose)

  return {
    headerHidden,
    startScrollSource,
    stopScrollSource,
    revealHeader,
    dispose,
  }
}
