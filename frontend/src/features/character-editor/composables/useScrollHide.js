import { ref, computed, onBeforeUnmount } from 'vue'
import { useAppHeaderCollapse } from '@/shared/composables/useAppHeaderCollapse'

export function isResizeObserverElement(el, ElementClass = typeof Element !== 'undefined' ? Element : null) {
  return !!ElementClass && el instanceof ElementClass
}

export function resolveCharacterViewHeight({
  isMobile,
  mobileAppHeaderVisible,
  headerHidden,
  viewportHeight = 'var(--character-viewport-height, 100dvh)',
}) {
  if (!isMobile || !mobileAppHeaderVisible || headerHidden) return viewportHeight
  return `calc(${viewportHeight} - var(--header-h))`
}

export function useScrollHide(isMobile, commonMobileScrollHide, options = {}) {
  const toolbarHeight = ref(48)
  const stripHidden = ref(false)
  const mobileAppHeaderVisible = options.mobileAppHeaderVisible !== false
  let pendingStripHidden = null

  function onScrollPosition({ y, delta }) {
    if (!isMobile.value) {
      pendingStripHidden = null
      stripHidden.value = false
      return
    }
    if (y <= 10) {
      pendingStripHidden = null
      stripHidden.value = false
      return
    }
    if (delta > 8) pendingStripHidden = true
    else if (delta < -5) pendingStripHidden = false
  }

  function onScrollSettled() {
    if (commonMobileScrollHide.value && pendingStripHidden != null) {
      stripHidden.value = pendingStripHidden
    }
    pendingStripHidden = null
  }

  const {
    headerHidden,
    startScrollSource,
    stopScrollSource,
    revealHeader,
  } = useAppHeaderCollapse(computed(() => isMobile.value && mobileAppHeaderVisible), {
    onPosition: onScrollPosition,
    onSettled: onScrollSettled,
  })

  const viewStyle = computed(() => {
    const viewportH = 'var(--character-viewport-height, 100dvh)'
    const h = resolveCharacterViewHeight({
      isMobile: isMobile.value,
      mobileAppHeaderVisible,
      headerHidden: headerHidden.value,
      viewportHeight: viewportH,
    })
    return { height: h, transition: 'height 0.34s cubic-bezier(0.22, 1, 0.36, 1)' }
  })

  // ── Active scroll source ──────────────────────────────────────────────

  function clearPendingStripUpdate() {
    pendingStripHidden = null
  }

  function startScrollListener(el, options = {}) {
    clearPendingStripUpdate()
    startScrollSource(el, options)
  }

  function stopScrollListener() {
    clearPendingStripUpdate()
    stopScrollSource()
  }

  // ── Toolbar height observer ───────────────────────────────────────────

  let toolbarObserver = null

  function observeToolbar(el) {
    toolbarObserver?.disconnect()
    toolbarObserver = null
    if (typeof ResizeObserver === 'undefined' || !isResizeObserverElement(el)) return
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
    stopScrollListener()
    disconnectToolbar()
  })

  return {
    toolbarHeight,
    stripHidden,
    headerHidden,
    viewStyle,
    startScrollListener,
    stopScrollListener,
    revealHeader,
    observeToolbar,
    disconnectToolbar,
  }
}
