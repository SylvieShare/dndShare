<template>
  <div
    ref="viewport"
    class="nested-graph-canvas"
    :class="{
      'nested-graph-canvas--panning': gesture?.type === 'pan',
      'nested-graph-canvas--selecting': gesture?.type === 'selection',
      'nested-graph-canvas--linking': linkingFrom || (gesture?.type === 'edge' && gesture.moved),
      'nested-graph-canvas--locked': locked,
      'nested-graph-canvas--spotlight': spotlightNodeId != null,
    }"
    @pointerdown="onCanvasDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="cancelGesture"
    @pointerleave="clearHoverTargets"
    @contextmenu="onContextMenu"
    @wheel.prevent="onWheel"
  >
    <div class="nested-graph-grid" :style="gridStyle" />
    <div v-if="selectionFrameStyle" class="nested-graph-selection-frame" :style="selectionFrameStyle" />
    <div class="nested-graph-world" :style="worldStyle">
      <svg class="nested-graph-edges" aria-hidden="true">
        <defs>
          <marker :id="markerId" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" class="nested-graph-edge-arrow" />
          </marker>
        </defs>
        <g
          v-for="edge in renderedEdges"
          :key="`${graphKey}:${edge.id}`"
          :class="{
            'nested-graph-edge--rewiring': isRewiringEdge(edge),
            'nested-graph-edge--endpoint-hover': hoveredEdgeId === edge.id,
          }"
        >
          <path class="nested-graph-edge-hit" :d="edge.path" @pointerdown.stop @click.stop="$emit('edge-click', edge.raw, $event.currentTarget)" />
          <path
            class="nested-graph-edge-line"
            :d="edge.path"
            :marker-start="edge.bidirectional ? `url(#${markerId})` : undefined"
            :marker-end="`url(#${markerId})`"
          />
          <template v-if="canEdit">
            <path
              class="nested-graph-edge-endpoint-zone"
              :d="edge.path"
              pathLength="100"
              stroke-dasharray="30 70"
              @pointerenter="hoverEdgeEndpoint(edge)"
              @pointerleave="leaveEdgeEndpoint(edge)"
              @pointerdown.stop="onEdgeEndpointDown($event, edge, 'from')"
            />
            <path
              class="nested-graph-edge-endpoint-zone"
              :d="edge.reversePath"
              pathLength="100"
              stroke-dasharray="30 70"
              @pointerenter="hoverEdgeEndpoint(edge)"
              @pointerleave="leaveEdgeEndpoint(edge)"
              @pointerdown.stop="onEdgeEndpointDown($event, edge, 'to')"
            />
          </template>
        </g>
        <path
          v-if="temporaryPath"
          class="nested-graph-edge-line nested-graph-edge-line--temporary"
          :d="temporaryPath"
          :marker-start="temporaryBidirectional ? `url(#${markerId})` : undefined"
          :marker-end="`url(#${markerId})`"
        />
      </svg>

      <button
        v-for="edge in labelledEdges"
        :key="`${graphKey}:label:${edge.id}`"
        type="button"
        class="nested-graph-edge-label"
        :disabled="locked"
        :style="{ transform: `translate(${edge.mid.x}px, ${edge.mid.y}px) translate(-50%, -50%)` }"
        @pointerdown.stop
        @click.stop="$emit('edge-click', edge.raw, $event.currentTarget)"
      >{{ edge.label }}</button>

      <div
        v-for="node in nodes"
        :key="`${graphKey}:${node.id}`"
        class="nested-graph-node"
        :data-graph-node-id="node.id"
        :class="{
          'nested-graph-node--linking': node.id === linkingFrom?.id,
          'nested-graph-node--target': isAvailableLinkTarget(node),
          'nested-graph-node--link-preview-target': node.id === previewTargetNode?.id,
          'nested-graph-node--spotlight': node.id === spotlightNodeId,
          'nested-graph-node--suppressed': spotlightNodeId != null && node.id !== spotlightNodeId,
          'nested-graph-node--selected': isSelected(node),
          'nested-graph-node--dragging': isDraggedNode(node),
          'nested-graph-node--dynamic-height': dynamicNodeHeight,
        }"
        :style="nodeStyle(node)"
        tabindex="0" role="button" :aria-label="node.title || node.name || 'Событие'"
        @keydown.enter.self.stop.prevent="$emit('node-click', node, $event.currentTarget)"
        @pointerdown="onNodeDown($event, node)"
        @click.stop="onLockedNodeClick($event, node)"
        @dblclick.stop="onNativeDoubleClick(node)"
      >
        <slot
          name="node"
          :node="node"
          :linking="node.id === linkingFrom?.id"
          :target="!!linkingFrom && node.id !== linkingFrom.id"
          :spotlight="node.id === spotlightNodeId"
          :selected="isSelected(node)"
        />
        <button
          v-if="canEdit"
          type="button"
          class="nested-graph-link-port"
          :disabled="spotlightNodeId != null"
          :title="node.id === linkingFrom?.id ? 'Отменить создание связи' : 'Создать связь отсюда'"
          @pointerdown.stop
          @click.stop="$emit('start-link', node)"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M2 6h8M7 3l3 3-3 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <button
          v-if="resizableNodes && canEdit"
          type="button"
          class="nested-graph-resize-handle"
          aria-label="Изменить ширину блока"
          title="Тяните, чтобы изменить ширину"
          @pointerdown.stop="onResizeDown($event, node)"
        />
      </div>
    </div>

    <div v-if="!loading && !nodes.length" class="nested-graph-empty">
      <span>ПУСТОЙ ХОЛСТ</span>
      <strong>{{ emptyTitle }}</strong>
      <p>{{ emptyDescription }}</p>
      <button v-if="canEdit && showEmptyAction" type="button" @click.stop="$emit('create-first')">{{ createLabel }}</button>
    </div>

    <div v-if="linkingFrom || (gesture?.type === 'edge' && gesture.moved)" class="nested-graph-link-hint">
      {{ gesture?.type === 'edge' ? 'Перетащите конец связи на другую карточку' : 'Выберите карточку, в которую ведёт связь' }} · Esc или ПКМ — отменить
    </div>

    <GraphSelectionBar
      v-if="bulkSelectionOpen"
      :count="selectedNodes.length"
      :status-options="statusOptions"
      @status="$emit('change-selection-status', $event, selectedNodes.map(node => node.id))"
      @delete="$emit('delete-selection', selectedNodes.map(node => node.id))"
      @clear="clearSelection"
    />
  </div>
</template>

<script setup>
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import GraphSelectionBar from '@/features/narrative-graph/components/GraphSelectionBar.vue'
import { useNarrativeNodeGeometry } from '../composables/useNarrativeNodeGeometry'
import { useNarrativeViewport } from '../composables/useNarrativeViewport'
import { useGraphHotkeys } from '@/features/narrative-graph/composables/useGraphHotkeys'
import { graphNodeKey, useGraphSelection } from '@/features/narrative-graph/composables/useGraphSelection'
import { useRafLatest } from '@/features/narrative-graph/composables/useRafLatest'
import { useNarrativeLinks } from '../composables/useNarrativeLinks'
import { graphContentBounds, translateGraphPositions } from '@/features/narrative-graph/lib/graphViewport'

const props = defineProps({
  graphKey: { type: String, required: true },
  nodes: { type: Array, default: () => [] },
  edges: { type: Array, default: () => [] },
  fromKey: { type: String, required: true },
  toKey: { type: String, required: true },
  nodeWidth: { type: Number, default: 236 },
  nodeHeight: { type: Number, default: 156 },
  minZoom: { type: Number, default: 0.35 },
  maxZoom: { type: Number, default: 1.8 },
  linkingFrom: { type: Object, default: null },
  locked: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  canEdit: { type: Boolean, default: false },
  spotlightNodeId: { type: [Number, String], default: null },
  spotlightX: { type: Number, default: null },
  spotlightOffsetX: { type: Number, default: 0 },
  spotlightY: { type: Number, default: 14 },
  initialTop: { type: Number, default: 210 },
  emptyTitle: { type: String, default: 'Здесь появятся карточки' },
  emptyDescription: { type: String, default: 'Создайте первую карточку и соединяйте карточки связями.' },
  createLabel: { type: String, default: 'Создать' },
  showEmptyAction: { type: Boolean, default: true },
  layoutKey: { type: [String, Number, Boolean], default: null },
  nodeWidthKey: { type: String, default: '' },
  dynamicNodeHeight: { type: Boolean, default: false },
  resizableNodes: { type: Boolean, default: false },
  minNodeWidth: { type: Number, default: 220 },
  maxNodeWidth: { type: Number, default: 640 },
  statusOptions: { type: Array, default: () => [] },
  multiSelect: { type: Boolean, default: true },
})
const emit = defineEmits([
  'node-click', 'node-double-click', 'edge-click', 'start-link', 'finish-link',
  'preview-positions', 'save-positions', 'preview-size', 'save-size', 'create-first',
  'selection-change', 'delete-selection', 'change-selection-status', 'drag-start', 'rewire-edge', 'interaction',
])

const instanceId = getCurrentInstance()?.uid ?? Math.random().toString(36).slice(2)
const markerId = `nested-graph-arrow-${instanceId}`
const viewport = ref(null)
const pan = ref({ x: 48, y: props.initialTop })
const zoom = ref(1)
const cursorWorld = ref(null)
const gesture = ref(null)
const linkPreviewTarget = ref(null)
const hoveredEdgeId = ref(null)
const viewportRevision = ref(0)
let lastNodeClick = null
let viewportResizeObserver = null
const preparedGraphKey = ref(null)

const worldStyle = computed(() => ({ transform: `translate(${pan.value.x}px, ${pan.value.y}px) scale(${zoom.value})` }))
const gridStyle = computed(() => ({
  backgroundPosition: `${pan.value.x}px ${pan.value.y}px`,
  backgroundSize: `${24 * zoom.value}px ${24 * zoom.value}px`,
}))
const { nodeDimensions, nodeStyle, refreshNodeObservers, resetDimensions } = useNarrativeNodeGeometry({ props, viewport, pan, zoom, viewportRevision, safeFrame: () => safeFrame() })
const nodeMap = computed(() => new Map(props.nodes.map(node => [node.id, node])))
const {
  selectedNodes, isSelected, clearSelection, selectAll, selectionFrameStyle,
  beginFrameSelection, updateFrameSelection, finishFrameSelection, cancelFrameSelection,
} = useGraphSelection(
  () => props.nodes,
  ids => emit('selection-change', ids),
)
const bulkSelectionOpen = computed(() => props.canEdit && !props.locked
  && !props.linkingFrom && props.spotlightNodeId == null && selectedNodes.value.length > 1)

const { renderedEdges, labelledEdges, temporaryPath, temporaryBidirectional, previewTargetNode } = useNarrativeLinks({ props, nodeMap, nodeDimensions, cursorWorld, gesture, linkPreviewTarget })
const contentBounds = computed(() => graphContentBounds(props.nodes, nodeDimensions))
const { schedule: emitPositionPreview, cancel: clearPositionPreviewFrame } = useRafLatest(
  positions => emit('preview-positions', positions),
)
const { viewKey, constrainPan, clampCurrentPan, loadView, prepareView, pointInWorld, safeFrame, onWheel, zoomBy, viewportCenter, focusNode, saveView, fitContent, hasSavedView } = useNarrativeViewport({ props, viewport, pan, zoom, contentBounds, nodeDimensions, preparedGraphKey })
useGraphHotkeys({
  element: viewport,
  enabled: () => props.canEdit && !props.locked && props.spotlightNodeId == null,
  selectedNodes,
  selectAll: () => { if (props.multiSelect) selectAll() },
  clearSelection,
  cancelGesture: () => { if (props.linkingFrom) emit('start-link', null); cancelGesture() },
  deleteSelection: ids => emit('delete-selection', ids),
  zoomBy,
})

function isDraggedNode(node) {
  if (gesture.value?.type === 'resize') return gesture.value.node.id === node.id
  return gesture.value?.type === 'node' && gesture.value.nodeKeys.has(graphNodeKey(node))
}

function isRewiringEdge(edge) {
  return gesture.value?.type === 'edge' && gesture.value.moved && edge.id === gesture.value.edge.id
}

function isAvailableLinkTarget(node) {
  if (props.linkingFrom) return String(node.id) !== String(props.linkingFrom.id)
  if (gesture.value?.type !== 'edge' || !gesture.value.moved) return false
  const fixed = gesture.value.endpoint === 'to' ? gesture.value.from : gesture.value.to
  return String(node.id) !== String(fixed.id)
}

function hoverEdgeEndpoint(edge) {
  if (gesture.value?.type !== 'edge') hoveredEdgeId.value = edge.id
}

function leaveEdgeEndpoint(edge) {
  if (hoveredEdgeId.value === edge.id && gesture.value?.type !== 'edge') hoveredEdgeId.value = null
}










function onCanvasDown(event) {
  if (props.locked || event.button !== 0) return
  if (event.target.closest('.nested-graph-node, .nested-graph-edge-label, .nested-graph-edge-hit, .nested-graph-edge-endpoint-zone')) return
  if (props.canEdit && props.multiSelect && (event.ctrlKey || event.metaKey)) {
    viewport.value.setPointerCapture(event.pointerId)
    gesture.value = beginFrameSelection(event, null, pointInWorld, viewport.value.getBoundingClientRect())
    return
  }
  clearSelection()
  viewport.value.setPointerCapture(event.pointerId)
  gesture.value = {
    type: 'pan',
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    panX: pan.value.x,
    panY: pan.value.y,
  }
}

function onEdgeEndpointDown(event, edge, endpoint) {
  if (props.locked || !props.canEdit || event.button !== 0) return
  const from = nodeMap.value.get(edge[props.fromKey])
  const to = nodeMap.value.get(edge[props.toKey])
  if (!from || !to) return
  clearSelection()
  cursorWorld.value = pointInWorld(event)
  viewport.value.setPointerCapture(event.pointerId)
  gesture.value = {
    type: 'edge',
    pointerId: event.pointerId,
    edge: edge.raw,
    endpoint,
    from,
    to,
    anchor: event.currentTarget,
    startClientX: event.clientX,
    startClientY: event.clientY,
    moved: false,
    hoveredTarget: null,
  }
}

function onNodeDown(event, node) {
  if (props.locked || event.button !== 0 || event.target.closest('button, input, textarea, [contenteditable="true"]')) return
  event.stopPropagation()
  if (props.linkingFrom && props.linkingFrom.id !== node.id) {
    emit('finish-link', node)
    return
  }
  viewport.value.setPointerCapture(event.pointerId)
  if (props.canEdit && props.multiSelect && (event.ctrlKey || event.metaKey)) {
    gesture.value = beginFrameSelection(event, node, pointInWorld, viewport.value.getBoundingClientRect())
    return
  }
  const draggingSelection = isSelected(node)
  if (!draggingSelection) clearSelection()
  const point = pointInWorld(event)
  const nodes = (draggingSelection ? selectedNodes.value : [node]).map(selected => ({
    id: selected.id,
    positionX: selected.positionX,
    positionY: selected.positionY,
  }))
  gesture.value = {
    type: 'node',
    pointerId: event.pointerId,
    node,
    nodeKeys: new Set(nodes.map(selected => graphNodeKey(selected.id))),
    nodes,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startWorldX: point.x,
    startWorldY: point.y,
    moved: false,
    anchor: event.currentTarget,
  }
}

function onResizeDown(event, node) {
  if (props.locked || event.button !== 0) return
  event.stopPropagation()
  viewport.value.setPointerCapture(event.pointerId)
  gesture.value = {
    type: 'resize',
    pointerId: event.pointerId,
    node,
    startX: event.clientX,
    startY: event.clientY,
    startWidth: nodeDimensions(node).width,
    moved: false,
  }
}

function onPointerMove(event) {
  if (props.locked) return
  cursorWorld.value = pointInWorld(event)
  const hoveredNode = nodeAtClientPoint(event.clientX, event.clientY)
  if (props.linkingFrom) {
    linkPreviewTarget.value = hoveredNode && String(hoveredNode.id) !== String(props.linkingFrom.id)
      ? hoveredNode
      : null
  }
  const active = gesture.value
  if (!active || active.pointerId !== event.pointerId) return
  if (active.type === 'pan') {
    pan.value = constrainPan({
      x: active.panX + event.clientX - active.startX,
      y: active.panY + event.clientY - active.startY,
    })
    return
  }
  if (active.type === 'resize') {
    active.moved ||= Math.abs(event.clientX - active.startX) > 2
    if (!active.moved) return
    const delta = (event.clientX - active.startX) / zoom.value
    const width = Math.max(props.minNodeWidth, Math.min(props.maxNodeWidth, active.startWidth + delta))
    emit('preview-size', active.node.id, Math.round(width))
    return
  }
  if (active.type === 'edge') {
    const wasMoved = active.moved
    active.moved ||= Math.hypot(event.clientX - active.startClientX, event.clientY - active.startClientY) > 4
    if (active.moved && !wasMoved) emit('drag-start')
    const fixed = active.endpoint === 'to' ? active.from : active.to
    active.hoveredTarget = hoveredNode && String(hoveredNode.id) !== String(fixed.id)
      ? hoveredNode
      : null
    return
  }
  if (active.type === 'selection') {
    updateFrameSelection(active, event, pointInWorld, nodeDimensions)
    return
  }
  if (!props.canEdit) return
  const point = pointInWorld(event)
  const wasMoved = active.moved
  active.moved ||= Math.hypot(event.clientX - active.startClientX, event.clientY - active.startClientY) > 4
  if (active.moved && !wasMoved) emit('drag-start', active.node)
  if (active.moved) {
    const deltaX = point.x - active.startWorldX
    const deltaY = point.y - active.startWorldY
    emitPositionPreview(translateGraphPositions(active.nodes, deltaX, deltaY))
  }
}

function onPointerUp(event) {
  const active = gesture.value
  if (!active || active.pointerId !== event.pointerId) return
  if (active.type === 'selection') {
    if (!active.moved && active.node) lastNodeClick = null
    finishFrameSelection(active)
    cancelGesture(false)
    return
  }
  if (active.type === 'edge') {
    if (active.moved) {
      const target = nodeAtClientPoint(event.clientX, event.clientY)
      const from = active.endpoint === 'from' ? target : active.from
      const to = active.endpoint === 'to' ? target : active.to
      if (from && to && String(from.id) !== String(to.id)
        && (String(from.id) !== String(active.from.id) || String(to.id) !== String(active.to.id))) {
        emit('rewire-edge', active.edge, from, to)
      }
    } else {
      emit('edge-click', active.edge, active.anchor)
    }
    cancelGesture(false)
    return
  }
  const contentMayHaveShrunk = active.moved && ['node', 'resize'].includes(active.type)
  if (active.type === 'pan') {
    saveView()
  } else if (active.type === 'resize') {
    if (active.moved) {
      const node = props.nodes.find(item => item.id === active.node.id)
      if (node) emit('save-size', node.id, nodeDimensions(node).width)
    }
  } else if (active.moved) {
    const point = pointInWorld(event)
    const deltaX = point.x - active.startWorldX
    const deltaY = point.y - active.startWorldY
    const positions = translateGraphPositions(active.nodes, deltaX, deltaY)
    clearPositionPreviewFrame()
    emit('preview-positions', positions)
    emit('save-positions', positions)
  } else {
    clearSelection()
    emit('node-click', active.node, active.anchor)
    const now = Date.now()
    if (lastNodeClick?.id === active.node.id && now - lastNodeClick.at < 500) {
      lastNodeClick = null
      emit('node-double-click', active.node)
    } else {
      lastNodeClick = { id: active.node.id, at: now }
    }
  }
  cancelGesture(false)
  if (contentMayHaveShrunk) nextTick(() => { if (clampCurrentPan()) saveView() })
}

function nodeAtClientPoint(clientX, clientY) {
  const element = document.elementFromPoint(clientX, clientY)?.closest?.('.nested-graph-node')
  const id = element?.dataset.graphNodeId
  return id == null ? null : nodeMap.value.get(id) ?? props.nodes.find(node => String(node.id) === id) ?? null
}

function clearHoverTargets() {
  linkPreviewTarget.value = null
  hoveredEdgeId.value = null
  if (gesture.value?.type === 'edge') gesture.value.hoveredTarget = null
}

function onContextMenu(event) {
  if (!props.linkingFrom) return
  event.preventDefault()
  clearHoverTargets()
  emit('start-link', null)
}

function onNativeDoubleClick(node) {
  if (props.locked) emit('node-double-click', node)
}

function onLockedNodeClick(event, node) {
  if (props.locked) emit('node-click', node, event.currentTarget)
}

function cancelGesture(rollback = true) {
  const active = gesture.value
  clearPositionPreviewFrame()
  if (rollback && active?.moved && active.type === 'node') emit('preview-positions', active.nodes)
  if (rollback && active?.moved && active.type === 'resize') emit('preview-size', active.node.id, active.startWidth)
  cancelFrameSelection()
  hoveredEdgeId.value = null
  gesture.value = null
}

watch(() => props.graphKey, graphKey => {
  clearSelection()
  resetDimensions()
  if (graphKey === preparedGraphKey.value) {
    preparedGraphKey.value = null
    nextTick(() => {
      refreshNodeObservers()
      if (clampCurrentPan()) saveView()
    })
    return
  }
  nextTick(() => {
    loadView(graphKey, props.initialTop)
    refreshNodeObservers()
  })
})
watch(() => props.linkingFrom, () => { linkPreviewTarget.value = null })
watch(gesture, value => emit('interaction', Boolean(value)), { flush: 'sync' })
watch(() => [props.nodes.length, props.dynamicNodeHeight], () => nextTick(refreshNodeObservers), { flush: 'post' })
watch(contentBounds, () => {
  if (['node', 'resize'].includes(gesture.value?.type)) return
  nextTick(() => { if (clampCurrentPan()) saveView() })
}, { flush: 'post' })
watch(() => props.layoutKey, async () => {
  await nextTick()
  requestAnimationFrame(() => {
    viewportRevision.value += 1
    if (clampCurrentPan()) saveView()
  })
}, { flush: 'post' })
watch(() => props.locked, locked => {
  if (!locked) return
  cancelGesture()
  clearSelection()
})
onMounted(() => {
  loadView()
  viewportResizeObserver = new ResizeObserver(() => {
    viewportRevision.value += 1
    if (clampCurrentPan()) saveView()
  })
  viewportResizeObserver.observe(viewport.value)

  nextTick(refreshNodeObservers)
})
onBeforeUnmount(() => {
  viewportResizeObserver?.disconnect()
})

defineExpose({ zoomBy, viewportCenter, focusNode, prepareView, clearSelection, fitContent, hasSavedView })
</script>

<style scoped src="./styles/NestedGraphCanvas.css"></style>
