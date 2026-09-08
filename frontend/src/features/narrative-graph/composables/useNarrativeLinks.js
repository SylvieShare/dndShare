import { computed } from 'vue'
import { graphEdgeGeometry, graphEdgeMidpoint, graphEdgePathFromPoint, graphEdgePathToPoint } from '../lib/graphGeometry'

export function useNarrativeLinks({ props, nodeMap, nodeDimensions, cursorWorld, gesture, linkPreviewTarget }) {
  const renderedEdges = computed(() => props.edges.map(edge => {
    const from = nodeMap.value.get(edge[props.fromKey])
    const to = nodeMap.value.get(edge[props.toKey])
    const geometry = from && to ? graphEdgeGeometry(from, to, nodeDimensions) : null
    return from && to
      ? { ...edge, raw: edge, ...geometry, mid: graphEdgeMidpoint(from, to, nodeDimensions) }
      : null
  }).filter(Boolean))
  const labelledEdges = computed(() => renderedEdges.value.filter(edge => edge.label))
  const temporaryPath = computed(() => {
    if (!cursorWorld.value) return ''
    if (gesture.value?.type === 'edge') {
      if (!gesture.value.moved) return ''
      const target = gesture.value.hoveredTarget
      if (target) {
        return gesture.value.endpoint === 'to'
          ? graphEdgeGeometry(gesture.value.from, target, nodeDimensions).path
          : graphEdgeGeometry(target, gesture.value.to, nodeDimensions).path
      }
      return gesture.value.endpoint === 'to'
        ? graphEdgePathToPoint(gesture.value.from, cursorWorld.value, nodeDimensions)
        : graphEdgePathFromPoint(cursorWorld.value, gesture.value.to, nodeDimensions)
    }
    if (!props.linkingFrom) return ''
    return linkPreviewTarget.value
      ? graphEdgeGeometry(props.linkingFrom, linkPreviewTarget.value, nodeDimensions).path
      : graphEdgePathToPoint(props.linkingFrom, cursorWorld.value, nodeDimensions)
  })
  const temporaryBidirectional = computed(() => gesture.value?.type === 'edge' && !!gesture.value.edge.bidirectional)
  const previewTargetNode = computed(() => gesture.value?.type === 'edge'
    ? gesture.value.hoveredTarget ?? null
    : linkPreviewTarget.value)

  return {renderedEdges, labelledEdges, temporaryPath, temporaryBidirectional, previewTargetNode}
}
