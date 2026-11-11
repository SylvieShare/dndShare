import { nextTick, onBeforeUnmount, watch } from 'vue'

// Animate the existing editor's layout: no second editable copy or lost selection.
export function useDescriptionTransition(element, editing) {
  let animation, epoch = 0
  watch(editing, async () => {
    const current = ++epoch
    const target = element.value
    if (!target) return
    const before = target.getBoundingClientRect().height
    animation?.cancel()
    await nextTick()
    if (current !== epoch || !target.isConnected || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const after = target.getBoundingClientRect().height
    animation = target.animate([
      { height: `${before}px`, opacity: 1 },
      { height: `${after}px`, opacity: 1 },
    ], { duration: 220, easing: 'cubic-bezier(.2,0,0,1)' })
  }, { flush: 'pre' })
  onBeforeUnmount(() => animation?.cancel())
}
