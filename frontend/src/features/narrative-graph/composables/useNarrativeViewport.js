import { clampGraphPan } from '../lib/graphViewport'
import { useGraphViewPersistence } from './useGraphViewPersistence'

export function useNarrativeViewport({ props, viewport, pan, zoom, contentBounds, nodeDimensions, preparedGraphKey }) {
  const { read: readView, save: saveView } = useGraphViewPersistence({ pan, zoom, getKey: viewKey, clamp: clampCurrentPan })
  let restoredView = false
  const hasSavedView = () => restoredView

  function viewKey(graphKey = props.graphKey) {
    return `nested-graph:view:${graphKey}`
  }

  function constrainPan(candidate, candidateZoom = zoom.value) {
    return clampGraphPan({
      pan: candidate,
      zoom: candidateZoom,
      frame: safeFrame(),
      bounds: contentBounds.value,
    })
  }

  function clampCurrentPan() {
    const next = constrainPan(pan.value)
    if (Math.abs(next.x - pan.value.x) < 0.01 && Math.abs(next.y - pan.value.y) < 0.01) return false
    pan.value = next
    return true
  }

  function loadView(graphKey = props.graphKey, initialTop = props.initialTop, constrain = true) {
    const saved = readView(graphKey)
    restoredView = Boolean(saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) && Number.isFinite(saved.zoom))
    if (restoredView) {
      zoom.value = Math.max(props.minZoom, Math.min(props.maxZoom, saved.zoom))
      const savedPan = { x: saved.x, y: saved.y }
      pan.value = constrain ? constrainPan(savedPan, zoom.value) : savedPan
      return
    }
    zoom.value = 1
    const initialPan = { x: safeFrame().left + 48, y: initialTop }
    pan.value = constrain ? constrainPan(initialPan, zoom.value) : initialPan
  }

  function prepareView(graphKey, initialTop) {
    preparedGraphKey.value = graphKey
    loadView(graphKey, initialTop, false)
  }

  function pointInWorld(event) {
    const rect = viewport.value.getBoundingClientRect()
    return {
      x: (event.clientX - rect.left - pan.value.x) / zoom.value,
      y: (event.clientY - rect.top - pan.value.y) / zoom.value,
    }
  }

  function safeFrame() {
    const element = viewport.value
    const rect = element?.getBoundingClientRect()
    if (!element || !rect) return { left: 0, right: 0, width: 0, height: 0 }
    const styles = getComputedStyle(element)
    const left = Number.parseFloat(styles.getPropertyValue('--chapter-safe-left')) || 0
    const right = Number.parseFloat(styles.getPropertyValue('--chapter-safe-right')) || 0
    return { left, right, width: Math.max(0, rect.width - left - right), height: rect.height }
  }

  function onWheel(event) {
    if (props.locked) return
    const rect = viewport.value.getBoundingClientRect()
    const before = pointInWorld(event)
    const next = Math.max(props.minZoom, Math.min(props.maxZoom, zoom.value * Math.exp(-event.deltaY * 0.0012)))
    zoom.value = next
    pan.value = constrainPan({
      x: event.clientX - rect.left - before.x * next,
      y: event.clientY - rect.top - before.y * next,
    }, next)
    saveView()
  }

  function zoomBy(factor) {
    if (props.locked || !viewport.value) return
    const rect = viewport.value.getBoundingClientRect()
    const frame = safeFrame()
    const centerX = frame.left + frame.width / 2
    const center = { clientX: rect.left + centerX, clientY: rect.top + rect.height / 2 }
    const before = pointInWorld(center)
    const next = Math.max(props.minZoom, Math.min(props.maxZoom, zoom.value * factor))
    zoom.value = next
    pan.value = constrainPan({ x: centerX - before.x * next, y: rect.height / 2 - before.y * next }, next)
    saveView()
  }

  function viewportCenter(nodeWidth = props.nodeWidth, nodeHeight = props.nodeHeight) {
    const rect = viewport.value?.getBoundingClientRect()
    if (!rect) return { x: 48, y: props.initialTop }
    const frame = safeFrame()
    return {
      x: (frame.left + frame.width / 2 - pan.value.x) / zoom.value - nodeWidth / 2,
      y: (rect.height / 2 - pan.value.y) / zoom.value - nodeHeight / 2,
    }
  }

  function focusNode(node) {
    if (!node || !viewport.value) return
    const rect = viewport.value.getBoundingClientRect()
    const frame = safeFrame()
    const dimensions = nodeDimensions(node)
    pan.value = constrainPan({
      x: frame.left + frame.width / 2 - (node.positionX + dimensions.width / 2) * zoom.value,
      y: rect.height / 2 - (node.positionY + dimensions.height / 2) * zoom.value,
    })
    saveView()
  }

  function fitContent() {
    const bounds = contentBounds.value
    if (!bounds || props.locked) return
    const frame = safeFrame()
    zoom.value = Math.max(props.minZoom, Math.min(1,
      (frame.width - 64) / (bounds.maxX - bounds.minX),
      (frame.height - 64) / (bounds.maxY - bounds.minY),
    ))
    pan.value = {
      x: frame.left + frame.width / 2 - (bounds.minX + bounds.maxX) / 2 * zoom.value,
      y: frame.height / 2 - (bounds.minY + bounds.maxY) / 2 * zoom.value,
    }
    saveView()
  }

  return { viewKey, constrainPan, clampCurrentPan, loadView, prepareView, pointInWorld, safeFrame, onWheel, zoomBy, viewportCenter, focusNode, saveView, fitContent, hasSavedView }
}
