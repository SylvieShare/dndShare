import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

// Context shares the identity row only when its real content fits beside it.
export function useWorkspaceContextLayout(main, identity, context, actions, props) {
  const inline = ref(false)
  let observer, mutations, frame, fonts
  function intrinsicWidth(node) {
    const width = node.style.width, maxWidth = node.style.maxWidth
    node.style.width = 'max-content'; node.style.maxWidth = 'none'
    const result = node.offsetWidth
    node.style.width = width; node.style.maxWidth = maxWidth
    return result
  }
  function measure() {
    if (!main.value || !context.value || !identity.value || !actions.value) return
    if (props.contextPlacement !== 'auto') { inline.value = props.contextPlacement === 'inline'; return }
    const style = getComputedStyle(main.value)
    const available = main.value.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      - actions.value.offsetWidth - intrinsicWidth(identity.value) - 2 * parseFloat(style.columnGap || 0)
    inline.value = available >= intrinsicWidth(context.value)
  }
  function schedule() { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure) }
  function observe() {
    observer?.disconnect(); mutations?.disconnect()
    if (!main.value || !context.value) { inline.value = false; return }
    for (const node of [main.value, identity.value, context.value, actions.value]) if (node) observer.observe(node)
    for (const node of [identity.value, context.value]) if (node) mutations.observe(node, { childList: true, characterData: true, subtree: true })
    schedule()
  }
  onMounted(() => {
    observer = new ResizeObserver(schedule); mutations = new MutationObserver(schedule)
    fonts = document.fonts; fonts?.addEventListener('loadingdone', schedule)
    observe()
  })
  watch([context, () => props.contextPlacement], () => { if (observer) observe() }, { flush: 'post' })
  onBeforeUnmount(() => {
    cancelAnimationFrame(frame); observer?.disconnect(); mutations?.disconnect()
    fonts?.removeEventListener('loadingdone', schedule)
  })
  return inline
}
