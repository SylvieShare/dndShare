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
        <g v-for="edge in renderedEdges" :key="edge.id">
          <path class="nested-graph-edge-hit" :d="edge.path" @pointerdown.stop @click.stop="$emit('edge-click', edge.raw)" />
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
        :key="`label-${edge.id}`"
        type="button"
        class="nested-graph-edge-label"
        :disabled="locked"
        :style="{ transform: `translate(${edge.mid.x}px, ${edge.mid.y}px) translate(-50%, -50%)` }"
        @pointerdown.stop
        @click.stop="$emit('edge-click', edge.raw)"
      >{{ edge.label }}</button>

      <div
        v-for="node in nodes"
        :key="node.id"
        class="nested-graph-node"
        :class="{
          'nested-graph-node--linking': node.id === linkingFrom?.id,
          'nested-graph-node--target': !!linkingFrom && node.id !== linkingFrom.id,
          'nested-graph-node--spotlight': node.id === spotlightNodeId,
          'nested-graph-node--suppressed': spotlightNodeId != null && node.id !== spotlightNodeId,
          'nested-graph-node--dragging': gesture?.type === 'node' && gesture.node.id === node.id,
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
      </div>
    </div>

    <div v-if="!loading && !nodes.length" class="nested-graph-empty">
      <span>ПУСТОЙ ХОЛСТ</span>
      <strong>{{ emptyTitle }}</strong>
      <p>{{ emptyDescription }}</p>
      <button v-if="canEdit" type="button" @click.stop="$emit('create-first')">{{ createLabel }}</button>
    </div>

    <div v-if="linkingFrom" class="nested-graph-link-hint">
      Выберите карточку, в которую ведёт связь · Esc — отменить
    </div>
  </div>
</template>

<script setup>
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

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
  spotlightX: { type: Number, default: 252 },
  spotlightY: { type: Number, default: 0 },
  initialTop: { type: Number, default: 210 },
  emptyTitle: { type: String, default: 'Здесь появятся карточки' },
  emptyDescription: { type: String, default: 'Создайте первую карточку и соединяйте карточки связями.' },
  createLabel: { type: String, default: 'Создать' },
})
const emit = defineEmits([
  'node-click', 'node-double-click', 'edge-click', 'start-link', 'finish-link',
  'preview-position', 'save-position', 'create-first', 'view-change',
])

const instanceId = getCurrentInstance()?.uid ?? Math.random().toString(36).slice(2)
const markerId = `nested-graph-arrow-${instanceId}`
const viewport = ref(null)
const pan = ref({ x: 48, y: props.initialTop })
const zoom = ref(1)
const cursorWorld = ref(null)
const gesture = ref(null)
let lastNodeClick = null

const worldStyle = computed(() => ({ transform: `translate(${pan.value.x}px, ${pan.value.y}px) scale(${zoom.value})` }))
const gridStyle = computed(() => ({
  backgroundPosition: `${pan.value.x}px ${pan.value.y}px`,
  backgroundSize: `${24 * zoom.value}px ${24 * zoom.value}px`,
}))
const nodeMap = computed(() => new Map(props.nodes.map(node => [node.id, node])))
const renderedEdges = computed(() => props.edges.map(edge => {
  const from = nodeMap.value.get(edge[props.fromKey])
  const to = nodeMap.value.get(edge[props.toKey])
  return from && to
    ? { ...edge, raw: edge, path: edgePath(from, to), mid: edgeMidpoint(from, to) }
    : null
}).filter(Boolean))
const labelledEdges = computed(() => renderedEdges.value.filter(edge => edge.label))
const temporaryPath = computed(() => {
  if (!props.linkingFrom || !cursorWorld.value) return ''
  return edgePath(props.linkingFrom, {
    positionX: cursorWorld.value.x - props.nodeWidth / 2,
    positionY: cursorWorld.value.y - props.nodeHeight / 2,
  })
})

function edgePath(from, to) {
  const fromCenterX = from.positionX + props.nodeWidth / 2
  const fromCenterY = from.positionY + props.nodeHeight / 2
  const toCenterX = to.positionX + props.nodeWidth / 2
  const toCenterY = to.positionY + props.nodeHeight / 2
  const direction = toCenterX >= fromCenterX ? 1 : -1
  const startX = fromCenterX + direction * props.nodeWidth / 2
  const endX = toCenterX - direction * props.nodeWidth / 2
  const bend = Math.max(70, Math.abs(endX - startX) * 0.45)
  return `M ${startX} ${fromCenterY} C ${startX + direction * bend} ${fromCenterY}, ${endX - direction * bend} ${toCenterY}, ${endX} ${toCenterY}`
}

function edgeMidpoint(from, to) {
  return {
    x: (from.positionX + to.positionX) / 2 + props.nodeWidth / 2,
    y: (from.positionY + to.positionY) / 2 + props.nodeHeight / 2,
  }
}

function nodeStyle(node) {
  const spotlight = node.id === props.spotlightNodeId
  const position = spotlight
    ? {
        x: (props.spotlightX - pan.value.x) / zoom.value,
        y: (props.spotlightY - pan.value.y) / zoom.value,
        scale: 1 / zoom.value,
      }
    : { x: node.positionX, y: node.positionY, scale: 1 }
  return {
    width: `${props.nodeWidth}px`,
    height: `${props.nodeHeight}px`,
    transform: `translate(${position.x}px, ${position.y}px) scale(${position.scale})`,
  }
}

function viewKey() {
  return `nested-graph:view:${props.graphKey}`
}

function loadView() {
  try {
    const saved = JSON.parse(localStorage.getItem(viewKey()) || 'null')
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) && Number.isFinite(saved.zoom)) {
      pan.value = { x: saved.x, y: saved.y }
      zoom.value = Math.max(0.35, Math.min(1.8, saved.zoom))
      announceView()
      return
    }
  } catch { /* ignore */ }
  pan.value = { x: 48, y: props.initialTop }
  zoom.value = 1
  announceView()
}

function saveView() {
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

function onCanvasDown(event) {
  if (props.locked || event.button !== 0) return
  if (event.target.closest('.nested-graph-node, .nested-graph-edge-label, .nested-graph-edge-hit')) return
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
  const point = pointInWorld(event)
  gesture.value = {
    type: 'node',
    pointerId: event.pointerId,
    node,
    startX: event.clientX,
    startY: event.clientY,
    offsetX: point.x - node.positionX,
    offsetY: point.y - node.positionY,
    moved: false,
  }
}

function onPointerMove(event) {
  if (props.locked) return
  cursorWorld.value = pointInWorld(event)
  const active = gesture.value
  if (!active || active.pointerId !== event.pointerId) return
  if (active.type === 'pan') {
    pan.value = {
      x: active.panX + event.clientX - active.startX,
      y: active.panY + event.clientY - active.startY,
    }
    announceView()
    return
  }
  const point = pointInWorld(event)
  active.moved ||= Math.hypot(event.clientX - active.startX, event.clientY - active.startY) > 4
  if (active.moved) emit('preview-position', active.node.id, point.x - active.offsetX, point.y - active.offsetY)
}

function onPointerUp(event) {
  const active = gesture.value
  if (!active || active.pointerId !== event.pointerId) return
  if (active.type === 'pan') {
    saveView()
  } else if (active.moved) {
    const node = props.nodes.find(item => item.id === active.node.id)
    if (node) emit('save-position', node.id, node.positionX, node.positionY)
  } else {
    emit('node-click', active.node)
    const now = Date.now()
    if (lastNodeClick?.id === active.node.id && now - lastNodeClick.at < 500) {
      lastNodeClick = null
      emit('node-double-click', active.node)
    } else {
      lastNodeClick = { id: active.node.id, at: now }
    }
  }
  cancelGesture()
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
  pan.value = {
    x: event.clientX - rect.left - before.x * next,
    y: event.clientY - rect.top - before.y * next,
  }
  saveView()
}

function zoomBy(factor) {
  if (props.locked || !viewport.value) return
  const rect = viewport.value.getBoundingClientRect()
  const center = { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 }
  const before = pointInWorld(center)
  const next = Math.max(0.35, Math.min(1.8, zoom.value * factor))
  zoom.value = next
  pan.value = { x: rect.width / 2 - before.x * next, y: rect.height / 2 - before.y * next }
  saveView()
}

function viewportCenter() {
  const rect = viewport.value?.getBoundingClientRect()
  if (!rect) return { x: 48, y: props.initialTop }
  return {
    x: (rect.width / 2 - pan.value.x) / zoom.value - props.nodeWidth / 2,
    y: (rect.height / 2 - pan.value.y) / zoom.value - props.nodeHeight / 2,
  }
}

function onKey(event) {
  if (event.key === 'Escape' && props.linkingFrom) emit('start-link', null)
}

watch(() => props.graphKey, () => nextTick(loadView))
watch(() => props.locked, locked => { if (locked) cancelGesture() })
onMounted(() => {
  loadView()
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

defineExpose({ zoomBy, viewportCenter })
</script>

<style scoped src="./styles/NestedGraphCanvas.css"></style>
