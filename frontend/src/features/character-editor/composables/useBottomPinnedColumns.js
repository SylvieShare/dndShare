import { onBeforeUnmount, onMounted } from 'vue'

// Native sticky owns scrolling; measurements change only when the layout changes.
export function useBottomPinnedColumns(root, columns) {
  let observer, frame
  function measure() {
    frame = undefined
    if (!root.value?.isConnected) return
    let viewport = root.value.parentElement, bottomInset = 0
    while (viewport) {
      const style = getComputedStyle(viewport)
      bottomInset += parseFloat(style.paddingBottom) || 0
      if (['auto', 'scroll', 'hidden'].includes(style.overflowY)) break
      bottomInset += parseFloat(style.marginBottom) || 0
      viewport = viewport.parentElement
    }
    const height = viewport?.clientHeight ?? document.documentElement.clientHeight
    for (const column of columns) {
      if (!column.value) continue
      column.value.style.setProperty('--sheet-side-sticky-top', `${Math.min(0, height - bottomInset - column.value.offsetHeight)}px`)
    }
  }
  function schedule() {
    if (frame === undefined) frame = requestAnimationFrame(measure)
  }
  onMounted(() => {
    observer = new ResizeObserver(schedule)
    // Include ancestors: the modal's outside padding and header height affect the viewport.
    for (let node = root.value; node; node = node.parentElement) observer.observe(node)
    for (const column of columns) if (column.value) observer.observe(column.value)
    measure()
  })
  onBeforeUnmount(() => { observer?.disconnect(); cancelAnimationFrame(frame) })
}
