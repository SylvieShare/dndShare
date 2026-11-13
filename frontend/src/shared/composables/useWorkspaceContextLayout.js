import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

// Context shares the identity row only when its real content fits beside it.
export function useWorkspaceContextLayout(main, identity, context, actions, props) {
  const inline = ref(false)
  let observer, mutations, frame, fonts
  function intrinsicWidth(node) {
    // Resizing the live context resets nested scroll positions and closes menus.
    // A sibling keeps the same inherited styles without touching live controls.
    const measure = node.cloneNode(true)
    measure.inert = true
    measure.setAttribute('aria-hidden', 'true')
    Object.assign(measure.style, {
      position: 'fixed', left: '-100000px', top: '0', visibility: 'hidden',
      pointerEvents: 'none', width: 'max-content', maxWidth: 'none',
    })
    node.parentElement.appendChild(measure)
    try { return measure.offsetWidth } finally { measure.remove() }
  }
  function measure() {
    if (!main.value || !context.value || !identity.value || !actions.value) return
    if (props.contextPlacement !== 'auto') { inline.value = props.contextPlacement === 'inline'; return }
    const style = getComputedStyle(main.value)
    // offsetWidth excludes the context's inline margin; reserve it before fitting.
    const inlineOffset = Math.max(0, parseFloat(style.getPropertyValue('--workspace-context-inline-offset')) || 0)
    const available = main.value.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      - actions.value.offsetWidth - intrinsicWidth(identity.value) - 2 * parseFloat(style.columnGap || 0) - inlineOffset
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
