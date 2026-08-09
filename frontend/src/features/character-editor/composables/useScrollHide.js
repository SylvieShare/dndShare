import { ref, computed, onBeforeUnmount } from 'vue'
import { useUiStore } from '@/stores/ui'

export function useScrollHide(isMobile, commonMobileScrollHide) {
  const SCROLL_SETTLE_MS = 120
  const toolbarHeight = ref(45)
  const stripHidden = ref(false)

  const uiStore = useUiStore()

  const headerHidden = computed(() => uiStore.headerHidden)

  const viewStyle = computed(() => {
    const headerH = isMobile.value ? 50 : 54
    const viewportH = 'var(--character-viewport-height, 100dvh)'
    const collapsed = headerHidden.value && isMobile.value
    const h = collapsed ? viewportH : `calc(${viewportH} - ${headerH}px)`
    return { height: h, transition: 'height 0.34s cubic-bezier(0.22, 1, 0.36, 1)' }
  })

  // ── Scroll listener on sheetScroll element ────────────────────────────

  let lastScrollY = 0
  let scrollEl = null
  let touchLastY = null
  let scrollSettleTimer = null
  let pendingStripHidden = null

  function clearPendingChromeUpdate() {
    clearTimeout(scrollSettleTimer)
    scrollSettleTimer = null
    pendingStripHidden = null
  }

  function scheduleChromeUpdate(y, delta) {
    clearTimeout(scrollSettleTimer)
    if (delta > 8) pendingStripHidden = true
    else if (delta < -5 || y < 10) pendingStripHidden = false
    scrollSettleTimer = setTimeout(() => {
      scrollSettleTimer = null
      uiStore.setHeaderHidden(y > 10)
      if (commonMobileScrollHide.value && pendingStripHidden != null) {
        stripHidden.value = pendingStripHidden
      }
      pendingStripHidden = null
    }, SCROLL_SETTLE_MS)
  }

  function onScroll() {
    if (!scrollEl) return
    const y = scrollEl.scrollTop
    uiStore.setScrollY(y)
    const delta = y - lastScrollY
    lastScrollY = y

    if (!isMobile.value) {
      if (y > 10) uiStore.setHeaderHidden(true)
      return
    }

    if (y < 10) {
      clearPendingChromeUpdate()
      uiStore.setHeaderHidden(false)
      stripHidden.value = false
      return
    }

    // Collapsing the app header or the common strip changes the height of the
    // native momentum scroller. Mobile browsers can amplify the active fling
    // when that happens, most noticeably on the first scroll after a reload.
    // Wait for the scroll stream to settle before changing either height.
    scheduleChromeUpdate(y, delta)
  }

  function onTouchStart(event) {
    touchLastY = event.touches?.[0]?.clientY ?? null
  }

  function onTouchMove(event) {
    const y = event.touches?.[0]?.clientY
    if (touchLastY == null || y == null || !scrollEl) return

    const fingerDelta = y - touchLastY
    if (scrollEl.scrollTop <= 0 && fingerDelta > 6) {
      uiStore.setHeaderHidden(false)
    }
    touchLastY = y
  }

  function onTouchEnd() {
    touchLastY = null
  }

  function startScrollListener(el, options = {}) {
    if (scrollEl === el) return
    clearPendingChromeUpdate()
    if (scrollEl) removeScrollElementListeners(scrollEl)
    scrollEl = el
    lastScrollY = el?.scrollTop || 0
    uiStore.setScrollY(lastScrollY)
    uiStore.setHeaderHidden(lastScrollY > 10 || (options.preserveHidden && uiStore.headerHidden))
    if (lastScrollY < 10) stripHidden.value = false
    addScrollElementListeners(el)
  }

  function stopScrollListener(el) {
    clearPendingChromeUpdate()
    removeScrollElementListeners(el)
    scrollEl = null
    touchLastY = null
    uiStore.setScrollY(0)
    uiStore.setHeaderHidden(false)
  }

  function addScrollElementListeners(el) {
    el?.addEventListener('scroll', onScroll, { passive: true })
    el?.addEventListener('touchstart', onTouchStart, { passive: true })
    el?.addEventListener('touchmove', onTouchMove, { passive: true })
    el?.addEventListener('touchend', onTouchEnd, { passive: true })
    el?.addEventListener('touchcancel', onTouchEnd, { passive: true })
  }

  function removeScrollElementListeners(el) {
    el?.removeEventListener('scroll', onScroll)
    el?.removeEventListener('touchstart', onTouchStart)
    el?.removeEventListener('touchmove', onTouchMove)
    el?.removeEventListener('touchend', onTouchEnd)
    el?.removeEventListener('touchcancel', onTouchEnd)
  }

  // ── Toolbar height observer ───────────────────────────────────────────

  let toolbarObserver = null

  function observeToolbar(el) {
    toolbarObserver?.disconnect()
    if (!el) return
    toolbarObserver = new ResizeObserver(entries => {
      const h = entries[0]?.contentRect?.height
      if (h) toolbarHeight.value = Math.round(h)
    })
    toolbarObserver.observe(el)
  }

  function disconnectToolbar() {
    toolbarObserver?.disconnect()
    toolbarObserver = null
  }

  onBeforeUnmount(() => {
    if (scrollEl) stopScrollListener(scrollEl)
    disconnectToolbar()
  })

  return {
    toolbarHeight,
    stripHidden,
    headerHidden,
    viewStyle,
    startScrollListener,
    stopScrollListener,
    observeToolbar,
    disconnectToolbar,
  }
}
