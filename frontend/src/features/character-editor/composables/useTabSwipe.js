import { ref, computed, watch, onBeforeUnmount, nextTick } from 'vue'

export function useTabSwipe(activeTabs, isMobile) {
  const activeTab = ref(0)
  const visitedTabs = ref([])
  const highlightedMobileTab = ref(0)

  const tabDragActive = ref(false)
  const tabDragSettling = ref(false)
  const tabDragX = ref(0)
  const tabDragWidth = ref(1)
  const tabDragDirection = ref(0)
  const tabSwipeBaseOffset = ref(0)
  const tabSwipeWrapMode = ref(null)
  const gestureBaseTab = ref(0)

  const mobileTabButtonRefs = ref([])
  const mobileTabRects = ref([])

  let swipeSettleTimer = null
  let highlightSettleTimer = null
  let touchStartX = null
  let touchStartY = null

  // ── Tab pane cache (stable component instances per tab) ──────────────
  const tabPaneCache = {}

  // ── Computed ──────────────────────────────────────────────────────────

  const visitedTabIndexes = computed(() =>
    visitedTabs.value.filter(i => i >= 0 && i < activeTabs.value.length)
  )

  const mobileTrackIndexes = computed(() => {
    const count = activeTabs.value.length
    if (!count) return []
    const indexes = Array.from({ length: count }, (_, i) => i)
    if (tabSwipeWrapMode.value === 'prev') return [count - 1, ...indexes.slice(0, count - 1)]
    if (tabSwipeWrapMode.value === 'next') return [...indexes.slice(1), 0]
    return indexes
  })

  const mobileActiveSlot = computed(() => {
    const slot = mobileTrackIndexes.value.indexOf(activeTab.value)
    return slot >= 0 ? slot : 0
  })

  const currentMobileTrackOffsetValue = computed(() =>
    (tabDragActive.value || tabDragSettling.value)
      ? tabSwipeBaseOffset.value + tabDragX.value
      : -mobileActiveSlot.value * tabDragWidth.value
  )

  const mobileSwipeTrackStyle = computed(() => ({
    transform: `translate3d(${currentMobileTrackOffsetValue.value}px, 0, 0)`,
  }))

  const mobileTabIndicatorStyle = computed(() => {
    const rect = interpolatedTabRect()
    return {
      width: `${rect.width}px`,
      transform: `translate3d(${rect.x}px, 0, 0)`,
    }
  })

  // ── Watchers ──────────────────────────────────────────────────────────

  watch(activeTabs, tabs => {
    if (activeTab.value >= tabs.length) activeTab.value = 0
    resetSwipe()
  })

  watch(activeTab, index => {
    markTabVisited(index)
    highlightedMobileTab.value = index
    nextTick(() => {
      updateMobileTabRects()
      scrollActiveMobileTabIntoView()
    })
  })

  onBeforeUnmount(() => {
    clearTimeout(swipeSettleTimer)
    clearTimeout(highlightSettleTimer)
  })

  // ── Tab visits ────────────────────────────────────────────────────────

  function markTabVisited(index) {
    if (index == null || index < 0) return
    if (!visitedTabs.value.includes(index)) {
      visitedTabs.value = [...visitedTabs.value, index]
    }
  }

  // ── Tab refs / rects ──────────────────────────────────────────────────

  function setMobileTabButtonRef(el, index) {
    if (el) mobileTabButtonRefs.value[index] = el
  }

  function updateMobileTabRects(tabbarEl) {
    if (!tabbarEl) return
    mobileTabRects.value = mobileTabButtonRefs.value.map(el =>
      el ? { x: el.offsetLeft, width: el.offsetWidth } : null
    )
  }

  function scrollActiveMobileTabIntoView() {
    mobileTabButtonRefs.value[activeTab.value]?.scrollIntoView?.({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    })
  }

  function interpolatedTabRect() {
    const fallback =
      mobileTabRects.value[highlightedMobileTab.value] ||
      mobileTabRects.value[activeTab.value] ||
      { x: 10, width: 44 }
    if (!isMobile.value || !tabDragWidth.value || !mobileTabRects.value.length) return fallback
    if (!tabDragActive.value && !tabDragSettling.value) return fallback

    const offset = currentMobileTrackOffsetValue.value
    const slotFloat = Math.max(
      0,
      Math.min(mobileTrackIndexes.value.length - 1, -offset / tabDragWidth.value)
    )
    const fromSlot = Math.floor(slotFloat)
    const toSlot = Math.min(mobileTrackIndexes.value.length - 1, fromSlot + 1)
    const progress = slotFloat - fromSlot
    const fromRect = mobileTabRects.value[mobileTrackIndexes.value[fromSlot]] || fallback
    const toRect = mobileTabRects.value[mobileTrackIndexes.value[toSlot]] || fromRect
    return {
      x: fromRect.x + (toRect.x - fromRect.x) * progress,
      width: fromRect.width + (toRect.width - fromRect.width) * progress,
    }
  }

  // ── Swipe state ───────────────────────────────────────────────────────

  function syncHighlightedTabFromOffset(offset = currentMobileTrackOffsetValue.value) {
    if (!isMobile.value || !tabDragWidth.value || !mobileTrackIndexes.value.length) return
    const slot = Math.max(
      0,
      Math.min(mobileTrackIndexes.value.length - 1, Math.round(-offset / tabDragWidth.value))
    )
    const index = mobileTrackIndexes.value[slot]
    if (index != null) highlightedMobileTab.value = index
  }

  function resetSwipe() {
    clearTimeout(swipeSettleTimer)
    clearTimeout(highlightSettleTimer)
    tabDragActive.value = false
    tabDragSettling.value = false
    tabDragX.value = 0
    tabDragDirection.value = 0
    tabSwipeBaseOffset.value = -mobileActiveSlot.value * tabDragWidth.value
    tabSwipeWrapMode.value = null
    highlightedMobileTab.value = activeTab.value
  }

  function wrapModeForDirection(direction) {
    if (direction > 0 && activeTab.value === 0) return 'prev'
    if (direction < 0 && activeTab.value === activeTabs.value.length - 1) return 'next'
    return null
  }

  function tabIndexFrom(index, delta) {
    const count = activeTabs.value.length
    return count ? (index + delta + count) % count : index
  }

  function scheduleSettleHighlight(fromOffset, targetOffset, targetIndex) {
    clearTimeout(highlightSettleTimer)
    const distance = Math.abs(targetOffset - fromOffset)
    const remaining = Math.max(0, distance - tabDragWidth.value / 2)
    const delay = Math.min(130, Math.max(0, Math.round((remaining / Math.max(distance, 1)) * 260)))
    highlightSettleTimer = setTimeout(() => {
      highlightedMobileTab.value = targetIndex
    }, delay)
  }

  function settleSwipeTo(targetIndex) {
    const targetSlot = mobileTrackIndexes.value.indexOf(targetIndex)
    const targetOffset = -(targetSlot >= 0 ? targetSlot : mobileActiveSlot.value) * tabDragWidth.value
    const fromOffset = currentMobileTrackOffsetValue.value
    tabDragActive.value = true
    tabDragSettling.value = false
    tabSwipeBaseOffset.value = fromOffset
    tabDragX.value = 0
    requestAnimationFrame(() => {
      tabDragSettling.value = true
      requestAnimationFrame(() => {
        tabDragX.value = targetOffset - tabSwipeBaseOffset.value
        scheduleSettleHighlight(fromOffset, targetOffset, targetIndex)
        clearTimeout(swipeSettleTimer)
        swipeSettleTimer = setTimeout(() => {
          activeTab.value = targetIndex
          tabDragActive.value = false
          tabDragSettling.value = false
          tabDragX.value = 0
          tabDragDirection.value = 0
          tabSwipeWrapMode.value = null
          tabSwipeBaseOffset.value = -mobileActiveSlot.value * tabDragWidth.value
        }, 260)
      })
    })
  }

  // ── Touch handlers ────────────────────────────────────────────────────

  function isSwipeBlocked(target) {
    return !!target?.closest?.('input, textarea, select, button, [contenteditable="true"], .mobile-tabbar')
  }

  function onTouchStart(event, containerEl) {
    if (!isMobile.value || activeTabs.value.length < 2) return
    if (isSwipeBlocked(event.target)) return
    if (tabDragSettling.value) return
    const touch = event.changedTouches?.[0]
    if (!touch) return
    clearTimeout(swipeSettleTimer)
    tabDragWidth.value = containerEl?.clientWidth || window.innerWidth || 1
    tabSwipeWrapMode.value = null
    tabDragDirection.value = 0
    tabDragX.value = 0
    tabSwipeBaseOffset.value = -mobileActiveSlot.value * tabDragWidth.value
    tabDragActive.value = false
    touchStartX = touch.clientX
    touchStartY = touch.clientY
    gestureBaseTab.value = highlightedMobileTab.value
  }

  function onTouchMove(event) {
    if (!isMobile.value || activeTabs.value.length < 2 || touchStartX == null) return
    const touch = event.changedTouches?.[0]
    if (!touch) return
    const dx = touch.clientX - touchStartX
    const dy = touch.clientY - touchStartY
    if (!tabDragActive.value || tabDragDirection.value === 0) {
      if (Math.abs(dx) < 6) return
      if (Math.abs(dx) < Math.abs(dy) * 0.85) {
        cancelTouch()
        return
      }
      tabDragActive.value = true
      tabDragDirection.value = dx < 0 ? -1 : 1
      tabSwipeWrapMode.value = wrapModeForDirection(tabDragDirection.value)
      tabSwipeBaseOffset.value = -mobileActiveSlot.value * tabDragWidth.value
    }
    event.preventDefault()
    const limit = tabDragWidth.value * 0.92
    tabDragX.value = Math.max(-limit, Math.min(limit, dx))
    syncHighlightedTabFromOffset()
  }

  function onTouchEnd(event) {
    if (!isMobile.value || activeTabs.value.length < 2 || touchStartX == null) return
    const touch = event.changedTouches?.[0]
    if (!touch) return
    const dx = tabDragActive.value ? tabDragX.value : touch.clientX - touchStartX
    const dy = touch.clientY - touchStartY
    touchStartX = null
    touchStartY = null
    const enoughDistance = Math.abs(dx) >= Math.min(32, tabDragWidth.value * 0.12)
    const enoughIntent = Math.abs(dx) >= Math.abs(dy) * 0.75
    if (!tabDragActive.value || !enoughDistance || !enoughIntent) {
      settleSwipeTo(activeTab.value)
      return
    }
    const delta = dx < 0 ? 1 : -1
    settleSwipeTo(tabIndexFrom(gestureBaseTab.value, delta))
  }

  function cancelTouch() {
    touchStartX = null
    touchStartY = null
    resetSwipe()
  }

  // ── Public setActiveTab (also used by tabbar click) ──────────────────

  function setActiveTab(index, mobileTrackEl, mobileTabbarEl) {
    if (index === activeTab.value) return
    if (isMobile.value) {
      if (tabDragSettling.value) return
      tabDragWidth.value =
        mobileTrackEl?.clientWidth ||
        mobileTabbarEl?.clientWidth ||
        window.innerWidth || 1
      tabSwipeWrapMode.value = null
      tabSwipeBaseOffset.value = -mobileActiveSlot.value * tabDragWidth.value
      tabDragX.value = 0
      tabDragDirection.value = index > activeTab.value ? -1 : 1
      tabDragActive.value = true
      settleSwipeTo(index)
      return
    }
    activeTab.value = index
  }

  // ── Tab pane cache ────────────────────────────────────────────────────

  function tabRenderComponent(index, TabPane) {
    if (!tabPaneCache[index]) {
      tabPaneCache[index] = { ...TabPane, name: `CharacterTabPane${index}` }
    }
    return tabPaneCache[index]
  }

  function tabKey(tab, index) {
    return tab?.id ?? tab?.key ?? tab?.title ?? index
  }

  return {
    activeTab,
    visitedTabs,
    visitedTabIndexes,
    highlightedMobileTab,
    tabDragActive,
    tabDragSettling,
    mobileTrackIndexes,
    mobileSwipeTrackStyle,
    mobileTabIndicatorStyle,
    mobileTabButtonRefs,
    markTabVisited,
    setMobileTabButtonRef,
    updateMobileTabRects,
    scrollActiveMobileTabIntoView,
    resetSwipe,
    settleSwipeTo,
    setActiveTab,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    cancelTouch,
    tabRenderComponent,
    tabKey,
  }
}
