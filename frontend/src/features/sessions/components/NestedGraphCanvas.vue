<template>
  <div
    ref="viewport"
    class="nested-graph-canvas"
    :class="{
      'nested-graph-canvas--panning': gesture?.type === 'pan',
      'nested-graph-canvas--linking': linkingFrom,
      'nested-graph-canvas--locked': locked,
      'nested-graph-canvas--spotlight': spotlightNodeId != null,
    }"
    @pointerdown="onCanvasDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="cancelGesture"
    @wheel.prevent="onWheel"
  >
    <div class="nested-graph-grid" :style="gridStyle" />
    <div class="nested-graph-world" :style="worldStyle">
      <svg class="nested-graph-edges" aria-hidden="true">
        <defs>
          <marker :id="markerId" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" class="nested-graph-edge-arrow" />
          </marker>
        </defs>
        <g v-for="edge in renderedEdges" :key="`${graphKey}:${edge.id}`">
          <path class="nested-graph-edge-hit" :d="edge.path" @pointerdown.stop @click.stop="$emit('edge-click', edge.raw, $event.currentTarget)" />
          <path class="nested-graph-edge-line" :d="edge.path" :marker-end="`url(#${markerId})`" />
        </g>
        <path
          v-if="temporaryPath"
          class="nested-graph-edge-line nested-graph-edge-line--temporary"
          :d="temporaryPath"
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
          'nested-graph-node--target': !!linkingFrom && node.id !== linkingFrom.id,
          'nested-graph-node--spotlight': node.id === spotlightNodeId,
          'nested-graph-node--suppressed': spotlightNodeId != null && node.id !== spotlightNodeId,
          'nested-graph-node--selected': isSelected(node),
          'nested-graph-node--dragging': isDraggedNode(node),
          'nested-graph-node--dynamic-height': dynamicNodeHeight,
        }"
        :style="nodeStyle(node)"
        @pointerdown="onNodeDown($event, node)"
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

    <div v-if="linkingFrom" class="nested-graph-link-hint">
      Выберите карточку, в которую ведёт связь · Esc — отменить
    </div>

    <GraphSelectionBar
      v-if="bulkSelectionOpen"
      :count="selectedNodes.length"
      @delete="requestSelectionDelete"
      @clear="clearSelection"
    />
  </div>
</template>

<script setup>
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import GraphSelectionBar from '@/features/sessions/components/GraphSelectionBar.vue'
import { graphNodeKey, useGraphSelection } from '@/features/sessions/composables/useGraphSelection'
import { graphEdgeMidpoint, graphEdgePath } from '@/features/sessions/lib/graphGeometry'
import { clampGraphPan, graphContentBounds, translateGraphPositions } from '@/features/sessions/lib/graphViewport'

const props = defineProps({
  graphKey: { type: String, required: true },
  nodes: { type: Array, default: () => [] },
  edges: { type: Array, default: () => [] },
  fromKey: { type: String, required: true },
  toKey: { type: String, required: true },
  nodeWidth: { type: Number, default: 236 },
  nodeHeight: { type: Number, default: 156 },
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
})
const emit = defineEmits([
  'node-click', 'node-double-click', 'edge-click', 'start-link', 'finish-link',
  'preview-positions', 'save-positions', 'preview-size', 'save-size', 'create-first', 'view-change',
  'selection-change', 'delete-selection',
])

const instanceId = getCurrentInstance()?.uid ?? Math.random().toString(36).slice(2)
const markerId = `nested-graph-arrow-${instanceId}`
const viewport = ref(null)
const pan = ref({ x: 48, y: props.initialTop })
const zoom = ref(1)
const cursorWorld = ref(null)
const gesture = ref(null)
const viewportRevision = ref(0)
const sizeRevision = ref(0)
const measuredHeights = new Map()
let lastNodeClick = null
let viewportResizeObserver = null
let nodeResizeObserver = null
let preparedGraphKey = null

const worldStyle = computed(() => ({ transform: `translate(${pan.value.x}px, ${pan.value.y}px) scale(${zoom.value})` }))
const gridStyle = computed(() => ({
  backgroundPosition: `${pan.value.x}px ${pan.value.y}px`,
  backgroundSize: `${24 * zoom.value}px ${24 * zoom.value}px`,
}))
const nodeMap = computed(() => new Map(props.nodes.map(node => [node.id, node])))
const { selectedNodes, isSelected, toggleSelection, clearSelection } = useGraphSelection(
  () => props.nodes,
  ids => emit('selection-change', ids),
)
const bulkSelectionOpen = computed(() => props.canEdit && !props.locked
  && !props.linkingFrom && props.spotlightNodeId == null && selectedNodes.value.length > 1)
const renderedEdges = computed(() => props.edges.map(edge => {
  const from = nodeMap.value.get(edge[props.fromKey])
  const to = nodeMap.value.get(edge[props.toKey])
  return from && to
    ? { ...edge, raw: edge, path: graphEdgePath(from, to, nodeDimensions), mid: graphEdgeMidpoint(from, to, nodeDimensions) }
    : null
}).filter(Boolean))
const labelledEdges = computed(() => renderedEdges.value.filter(edge => edge.label))
const temporaryPath = computed(() => {
  if (!props.linkingFrom || !cursorWorld.value) return ''
  const dimensions = nodeDimensions(props.linkingFrom)
  return graphEdgePath(props.linkingFrom, {
    positionX: cursorWorld.value.x - dimensions.width / 2,
    positionY: cursorWorld.value.y - dimensions.height / 2,
    _graphWidth: dimensions.width,
    _graphHeight: dimensions.height,
  }, nodeDimensions)
})
const contentBounds = computed(() => graphContentBounds(props.nodes, nodeDimensions))

function isDraggedNode(node) {
  if (gesture.value?.type === 'resize') return gesture.value.node.id === node.id
  return gesture.value?.type === 'node' && gesture.value.nodeKeys.has(graphNodeKey(node))
}

function requestSelectionDelete() {
  emit('delete-selection', selectedNodes.value.map(node => node.id))
}

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
  const frame = safeFrame()
  const spotlightX = props.spotlightX ?? (frame.left + props.spotlightOffsetX)
  const dimensions = nodeDimensions(node)
  const position = spotlight
    ? {
        x: (spotlightX - pan.value.x) / zoom.value,
        y: (props.spotlightY - pan.value.y) / zoom.value,
        scale: 1 / zoom.value,
      }
    : { x: node.positionX, y: node.positionY, scale: 1 }
  return {
    width: `${dimensions.width}px`,
    ...(props.dynamicNodeHeight
      ? { minHeight: `${props.nodeHeight}px` }
      : { height: `${dimensions.height}px` }),
    transform: `translate(${position.x}px, ${position.y}px) scale(${position.scale})`,
  }
}

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
  try {
    const saved = JSON.parse(localStorage.getItem(viewKey(graphKey)) || 'null')
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) && Number.isFinite(saved.zoom)) {
      zoom.value = Math.max(0.35, Math.min(1.8, saved.zoom))
      const savedPan = { x: saved.x, y: saved.y }
      pan.value = constrain ? constrainPan(savedPan, zoom.value) : savedPan
      announceView()
      return
    }
  } catch { /* ignore */ }
  zoom.value = 1
  const initialPan = { x: safeFrame().left + 48, y: initialTop }
  pan.value = constrain ? constrainPan(initialPan, zoom.value) : initialPan
  announceView()
}

function prepareView(graphKey, initialTop) {
  preparedGraphKey = graphKey
  loadView(graphKey, initialTop, false)
}

function saveView() {
  clampCurrentPan()
  try { localStorage.setItem(viewKey(), JSON.stringify({ ...pan.value, zoom: zoom.value })) } catch { /* ignore */ }
  announceView()
}

function announceView() {
  emit('view-change', { pan: pan.value, zoom: zoom.value })
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

function onCanvasDown(event) {
  if (props.locked || event.button !== 0) return
  if (event.target.closest('.nested-graph-node, .nested-graph-edge-label, .nested-graph-edge-hit')) return
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

function onNodeDown(event, node) {
  if (props.locked || event.button !== 0 || event.target.closest('button, input, textarea, [contenteditable="true"]')) return
  event.stopPropagation()
  if (props.linkingFrom && props.linkingFrom.id !== node.id) {
    emit('finish-link', node)
    return
  }
  viewport.value.setPointerCapture(event.pointerId)
  if (props.canEdit && (event.ctrlKey || event.metaKey)) {
    gesture.value = {
      type: 'selection',
      pointerId: event.pointerId,
      node,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    }
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
  const active = gesture.value
  if (!active || active.pointerId !== event.pointerId) return
  if (active.type === 'pan') {
    pan.value = constrainPan({
      x: active.panX + event.clientX - active.startX,
      y: active.panY + event.clientY - active.startY,
    })
    announceView()
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
  if (active.type === 'selection') {
    active.moved ||= Math.hypot(event.clientX - active.startX, event.clientY - active.startY) > 4
    return
  }
  const point = pointInWorld(event)
  active.moved ||= Math.hypot(event.clientX - active.startClientX, event.clientY - active.startClientY) > 4
  if (active.moved) {
    const deltaX = point.x - active.startWorldX
    const deltaY = point.y - active.startWorldY
    emit('preview-positions', translateGraphPositions(active.nodes, deltaX, deltaY))
  }
}

function onPointerUp(event) {
  const active = gesture.value
  if (!active || active.pointerId !== event.pointerId) return
  if (active.type === 'selection') {
    if (!active.moved) {
      lastNodeClick = null
      toggleSelection(active.node)
    }
    cancelGesture()
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
  cancelGesture()
  if (contentMayHaveShrunk) nextTick(() => { if (clampCurrentPan()) saveView() })
}

function onNativeDoubleClick(node) {
  if (props.locked) emit('node-double-click', node)
}

function cancelGesture() {
  gesture.value = null
}

function onWheel(event) {
  if (props.locked) return
  const rect = viewport.value.getBoundingClientRect()
  const before = pointInWorld(event)
  const next = Math.max(0.35, Math.min(1.8, zoom.value * Math.exp(-event.deltaY * 0.0012)))
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
  const next = Math.max(0.35, Math.min(1.8, zoom.value * factor))
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

function onKey(event) {
  if (event.key !== 'Escape') return
  if (props.linkingFrom) emit('start-link', null)
  clearSelection()
}

function refreshNodeObservers() {
  nodeResizeObserver?.disconnect()
  if (!props.dynamicNodeHeight || !viewport.value) return
  for (const element of viewport.value.querySelectorAll('.nested-graph-node')) nodeResizeObserver?.observe(element)
}

watch(() => props.graphKey, graphKey => {
  clearSelection()
  measuredHeights.clear()
  sizeRevision.value += 1
  if (graphKey === preparedGraphKey) {
    preparedGraphKey = null
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
  nextTick(refreshNodeObservers)
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  viewportResizeObserver?.disconnect()
  nodeResizeObserver?.disconnect()
  window.removeEventListener('keydown', onKey)
})

defineExpose({ zoomBy, viewportCenter, focusNode, prepareView, clearSelection })
</script>

<style scoped src="./styles/NestedGraphCanvas.css"></style>
