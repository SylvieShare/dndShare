import { watch } from 'vue'

// Page and modal share one active-scroll binding. Inactive panes cannot change chrome.
export function useSheetScrollPosition(header, getScrollElement) {
  watch(() => [header.value, getScrollElement()], ([chrome, element], _, cleanup) => {
    if (!chrome) return
    const update = () => chrome.setScrollPosition?.(element?.scrollTop || 0)
    update()
    element?.addEventListener('scroll', update, { passive: true })
    cleanup(() => element?.removeEventListener('scroll', update))
  }, { immediate: true, flush: 'post' })
}
