import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { workspaceHeaderGroups } from '@/shared/lib/workspaceHeaderGroups'

// Fit whole details and context groups in order without moving their live DOM.
export function useWorkspaceContextLayout(main, identity, context, actions, props, details) {
  const contextInline = ref(false), detailsInline = ref(false), contextInDetailsRow = ref(false)
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
    if (!main.value || !identity.value || !actions.value) return
    const style = getComputedStyle(main.value)
    // offsetWidth excludes the context's inline margin; reserve it before fitting.
    const inlineOffset = Math.max(0, parseFloat(style.getPropertyValue('--workspace-context-inline-offset')) || 0)
    const layout = workspaceHeaderGroups({
      width: main.value.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
      identity: intrinsicWidth(identity.value), actions: actions.value.offsetWidth,
      details: details?.value ? intrinsicWidth(details.value) : null,
      context: context.value ? intrinsicWidth(context.value) : null,
      gap: parseFloat(style.columnGap || 0), offset: inlineOffset, placement: props.contextPlacement,
    })
    contextInline.value = layout.contextInline; detailsInline.value = layout.detailsInline; contextInDetailsRow.value = layout.contextInDetailsRow
  }
  function schedule() { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure) }
  function observe() {
    observer?.disconnect(); mutations?.disconnect()
    if (!main.value || (!context.value && !details?.value)) {
      contextInline.value = false; detailsInline.value = false; contextInDetailsRow.value = false
      return
    }
    for (const node of [main.value, identity.value, details?.value, context.value, actions.value]) if (node) observer.observe(node)
    for (const node of [identity.value, details?.value, context.value]) if (node) mutations.observe(node, { childList: true, characterData: true, subtree: true })
    schedule()
  }
  onMounted(() => {
    observer = new ResizeObserver(schedule); mutations = new MutationObserver(schedule)
    fonts = document.fonts; fonts?.addEventListener('loadingdone', schedule)
    observe()
  })
  watch([context, () => details?.value, () => props.contextPlacement], () => { if (observer) observe() }, { flush: 'post' })
  onBeforeUnmount(() => {
    cancelAnimationFrame(frame); observer?.disconnect(); mutations?.disconnect()
    fonts?.removeEventListener('loadingdone', schedule)
  })
  return { contextInline, detailsInline, contextInDetailsRow }
}
