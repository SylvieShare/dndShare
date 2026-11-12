import { watch } from 'vue'

export function useWorkspaceScrollPosition(header, getScrollElement) {
  watch(() => [header.value, getScrollElement()], ([chrome, element], _, cleanup) => {
    if (!chrome) return
    const update = () => chrome.setScrollPosition?.(typeof window !== 'undefined' && element === window ? window.scrollY : element?.scrollTop || 0)
    update()
    element?.addEventListener('scroll', update, { passive: true })
    cleanup(() => element?.removeEventListener('scroll', update))
  }, { immediate: true, flush: 'post' })
}
