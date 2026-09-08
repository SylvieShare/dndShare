import { ref, onMounted, onBeforeUnmount } from 'vue'

export function useNarrativeNodeGeometry({ props, viewport, pan, zoom, viewportRevision, safeFrame }) {
  const measuredHeights = new Map()
  const sizeRevision = ref(0)
  let nodeResizeObserver = null

  function nodeDimensions(node) {
    sizeRevision.value
    const rawWidth = node?._graphWidth ?? (props.nodeWidthKey ? node?.[props.nodeWidthKey] : null)
    const width = Number(rawWidth) || props.nodeWidth
    const measured = measuredHeights.get(String(node?.id))
    const height = Number(node?._graphHeight) || measured || props.nodeHeight
    return { width, height }
  }

  function nodeStyle(node) {
    viewportRevision.value
    const spotlight = node.id === props.spotlightNodeId
    const dimensions = nodeDimensions(node)
    let position = { x: node.positionX, y: node.positionY, scale: 1 }
    if (spotlight) {
      const frame = safeFrame()
      const spotlightX = props.spotlightX ?? (frame.left + props.spotlightOffsetX)
      position = {
        x: (spotlightX - pan.value.x) / zoom.value,
        y: (props.spotlightY - pan.value.y) / zoom.value,
        scale: 1 / zoom.value,
      }
    }
    return {
      width: `${dimensions.width}px`,
      ...(props.dynamicNodeHeight
        ? { minHeight: `${props.nodeHeight}px` }
        : { height: `${dimensions.height}px` }),
      transform: `translate(${position.x}px, ${position.y}px) scale(${position.scale})`,
    }
  }

  function refreshNodeObservers() {
    nodeResizeObserver?.disconnect()
    if (!props.dynamicNodeHeight || !viewport.value) return
    for (const element of viewport.value.querySelectorAll('.nested-graph-node')) nodeResizeObserver?.observe(element)
  }

  function resetDimensions() { measuredHeights.clear(); sizeRevision.value += 1 }
  onMounted(() => {
    nodeResizeObserver = new ResizeObserver(entries => {
      let changed = false
      for (const entry of entries) {
        const id = entry.target.dataset.graphNodeId
        const height = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height
        if (!id || !Number.isFinite(height) || Math.abs((measuredHeights.get(id) || 0) - height) < 0.5) continue
        measuredHeights.set(id, height)
        changed = true
      }
      if (changed) sizeRevision.value += 1
    })
    refreshNodeObservers()
  })
  onBeforeUnmount(() => nodeResizeObserver?.disconnect())
  return { nodeDimensions, nodeStyle, refreshNodeObservers, resetDimensions }
}
