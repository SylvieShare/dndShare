import { computed, ref } from 'vue'

export function tabSelectionWeights(count, indexes, position) {
  const weights = Array(count).fill(0)
  if (!indexes.length) return weights
  const slot = Math.max(0, Math.min(indexes.length - 1, position))
  const from = Math.floor(slot), to = Math.min(indexes.length - 1, from + 1)
  weights[indexes[from]] += 1 - (slot - from)
  weights[indexes[to]] += slot - from
  return weights
}

// Allocate the extra selected width continuously. Total strip width stays constant,
// so crossing the gesture midpoint never moves every following icon by one step.
export function tabBarRects(weights, { width, start, end, gap, minimum, selected, maximum }) {
  const extra = selected - minimum
  const base = Math.max(minimum, (width - start - end - gap * (weights.length - 1) - extra) / weights.length)
  let x = start
  return weights.map(weight => {
    const rect = { x, width: Math.min(maximum, base + extra * weight) }
    x += rect.width + gap
    return rect
  })
}

export function measureMobileTabRects(tabbarEl, tabButtonEls) {
  if (!tabbarEl) return []
  const tabbarRect = tabbarEl.getBoundingClientRect()
  return tabButtonEls.map(el => {
    if (!el) return null
    const rect = el.getBoundingClientRect()
    return { x: rect.left - tabbarRect.left + tabbarEl.scrollLeft, width: rect.width }
  })
}

export function mobileTabRectsEqual(current, next) {
  return current.length === next.length && current.every((rect, index) => {
    const other = next[index]
    return rect == null || other == null ? rect === other : rect.x === other.x && rect.width === other.width
  })
}

export function useMobileTabBar(activeTab, selection, tabbarRef) {
  const mobileTabButtonRefs = ref([]), measured = ref([]), layout = ref(null)
  let lastTabbar = null
  const rects = computed(() => layout.value ? tabBarRects(selection.value, layout.value) : measured.value)
  const mobileTabButtonStyles = computed(() => selection.value.map((weight, i) => ({
    '--tab-selection': weight,
    '--mobile-tab-width': layout.value ? `${rects.value[i].width}px` : undefined,
  })))
  const mobileTabIndicatorStyle = computed(() => {
    const fallback = measured.value[activeTab.value] || { x: 8, width: 44 }
    const rect = selection.value.reduce((sum, weight, i) => ({
      x: sum.x + (rects.value[i] || fallback).x * weight,
      width: sum.width + (rects.value[i] || fallback).width * weight,
    }), { x: 0, width: 0 })
    return { width: `${rect.width || fallback.width}px`, transform: `translate3d(${rect.x}px, 0, 0)` }
  })

  function setMobileTabButtonRef(el, index) {
    // Function refs also run on visual progress updates; never measure in this callback.
    mobileTabButtonRefs.value[index] = el || null
  }
  function updateMobileTabRects(tabbar) {
    lastTabbar = tabbar || tabbarRef?.value || lastTabbar
    if (!lastTabbar) return
    if (lastTabbar.nodeType === 1) {
      const style = getComputedStyle(lastTabbar)
      const number = name => Number.parseFloat(style.getPropertyValue(name))
      const next = { width: lastTabbar.clientWidth, start: number('padding-left'), end: number('padding-right'),
        gap: number('column-gap'), minimum: number('--mobile-tab-min-width'),
        selected: number('--layout-sheet-navigation-selected'), maximum: number('--mobile-tab-max-width') }
      if (Object.values(next).every(Number.isFinite)) {
        if (JSON.stringify(next) !== JSON.stringify(layout.value)) layout.value = next
        return
      }
    }
    const next = measureMobileTabRects(lastTabbar, mobileTabButtonRefs.value)
    if (!mobileTabRectsEqual(measured.value, next)) measured.value = next
  }
  function scrollActiveMobileTabIntoView() {
    mobileTabButtonRefs.value[activeTab.value]?.scrollIntoView?.({
      behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      inline: 'center', block: 'nearest',
    })
  }
  return { mobileTabButtonRefs, mobileTabButtonStyles, mobileTabIndicatorStyle,
    setMobileTabButtonRef, updateMobileTabRects, scrollActiveMobileTabIntoView }
}
