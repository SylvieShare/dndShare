import { computed, ref, toValue, watch } from 'vue'

export function graphNodeKey(nodeOrId) {
  return String(typeof nodeOrId === 'object' ? nodeOrId?.id : nodeOrId)
}

export function useGraphSelection(nodes, onChange) {
  const selectedKeys = ref(new Set())
  const selectedNodes = computed(() => toValue(nodes).filter(isSelected))
  const selectionFrame = ref(null)
  const selectionFrameStyle = computed(() => {
    const frame = selectionFrame.value
    if (!frame) return null
    return {
      left: `${Math.min(frame.startX, frame.endX)}px`,
      top: `${Math.min(frame.startY, frame.endY)}px`,
      width: `${Math.abs(frame.endX - frame.startX)}px`,
      height: `${Math.abs(frame.endY - frame.startY)}px`,
    }
  })

  function isSelected(node) {
    return selectedKeys.value.has(graphNodeKey(node))
  }

  function updateSelection(keys) {
    const next = new Set(keys)
    const current = selectedKeys.value
    if (next.size === current.size && [...next].every(key => current.has(key))) return
    selectedKeys.value = next
    onChange(selectedNodes.value.map(node => node.id))
  }

  function toggleSelection(node) {
    const next = new Set(selectedKeys.value)
    const key = graphNodeKey(node)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    updateSelection(next)
  }

  function beginFrameSelection(event, node, pointInWorld, viewportRect) {
    return {
      type: 'selection',
      pointerId: event.pointerId,
      node,
      startX: event.clientX,
      startY: event.clientY,
      startWorld: pointInWorld(event),
      startViewport: { x: event.clientX - viewportRect.left, y: event.clientY - viewportRect.top },
      initialKeys: new Set(selectedKeys.value),
      moved: false,
    }
  }

  function updateFrameSelection(active, event, pointInWorld, nodeDimensions) {
    active.moved ||= Math.hypot(event.clientX - active.startX, event.clientY - active.startY) > 4
    if (!active.moved) return
    const currentWorld = pointInWorld(event)
    const left = Math.min(active.startWorld.x, currentWorld.x)
    const right = Math.max(active.startWorld.x, currentWorld.x)
    const top = Math.min(active.startWorld.y, currentWorld.y)
    const bottom = Math.max(active.startWorld.y, currentWorld.y)
    const hits = toValue(nodes).filter(node => {
      const dimensions = nodeDimensions(node)
      return node.positionX <= right && node.positionX + dimensions.width >= left
        && node.positionY <= bottom && node.positionY + dimensions.height >= top
    })
    updateSelection([...active.initialKeys, ...hits.map(graphNodeKey)])
    selectionFrame.value = {
      startX: active.startViewport.x,
      startY: active.startViewport.y,
      endX: active.startViewport.x + event.clientX - active.startX,
      endY: active.startViewport.y + event.clientY - active.startY,
    }
  }

  function finishFrameSelection(active) {
    selectionFrame.value = null
    if (!active.moved && active.node) toggleSelection(active.node)
  }

  function cancelFrameSelection() {
    selectionFrame.value = null
  }

  function clearSelection() {
    updateSelection([])
  }

  function selectAll() {
    updateSelection(toValue(nodes).map(graphNodeKey))
  }

  watch(() => toValue(nodes).map(graphNodeKey).join('|'), () => {
    const available = new Set(toValue(nodes).map(graphNodeKey))
    updateSelection([...selectedKeys.value].filter(key => available.has(key)))
  })

  return {
    selectedNodes, isSelected, toggleSelection, clearSelection, selectAll,
    selectionFrameStyle, beginFrameSelection, updateFrameSelection, finishFrameSelection, cancelFrameSelection,
  }
}
