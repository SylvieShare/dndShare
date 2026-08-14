<template>
  <div
    ref="viewport"
    class="chapter-canvas"
    :class="{
      'chapter-canvas--panning': gesture?.type === 'pan',
      'chapter-canvas--linking': linkingFrom,
      'chapter-canvas--locked': locked,
      'chapter-canvas--spotlight': spotlightChapterId != null,
    }"
    @pointerdown="onCanvasDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="cancelGesture"
    @wheel.prevent="onWheel"
  >
    <div class="chapter-grid" :style="gridStyle" />
    <div class="chapter-world" :style="worldStyle">
      <svg class="chapter-edges" aria-hidden="true">
        <defs>
          <marker id="chapter-edge-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" class="chapter-edge-arrow" />
          </marker>
        </defs>
        <g v-for="edge in renderedEdges" :key="edge.id">
          <path class="chapter-edge-hit" :d="edge.path" @pointerdown.stop @click.stop="$emit('edge-click', edge.raw, $event.currentTarget)" />
          <path class="chapter-edge-line" :d="edge.path" marker-end="url(#chapter-edge-arrow)" />
        </g>
        <path v-if="temporaryPath" class="chapter-edge-line chapter-edge-line--temporary" :d="temporaryPath" marker-end="url(#chapter-edge-arrow)" />
      </svg>

      <button
        v-for="edge in labelledEdges"
        :key="`label-${edge.id}`"
        type="button"
        class="chapter-edge-label"
        :disabled="locked"
        :tabindex="locked ? -1 : 0"
        :aria-hidden="spotlightChapterId != null ? 'true' : undefined"
        :style="{ transform: `translate(${edge.mid.x}px, ${edge.mid.y}px) translate(-50%, -50%)` }"
        @pointerdown.stop
        @click.stop="$emit('edge-click', edge.raw, $event.currentTarget)"
      >{{ edge.label }}</button>

      <ChapterGraphNode
        v-for="chapter in chapters"
        :key="chapter.id"
        :chapter="chapter"
        :current="chapter.id === currentChapterId"
        :linking="chapter.id === linkingFrom?.id"
        :target="!!linkingFrom && chapter.id !== linkingFrom.id"
        :presentation="chapter.id === spotlightChapterId ? spotlightPresentation : null"
        :spotlight="chapter.id === spotlightChapterId"
        :suppressed="spotlightChapterId != null && chapter.id !== spotlightChapterId"
        :dragging="gesture?.type === 'node' && gesture.chapter.id === chapter.id"
        @pointerdown="onNodeDown"
        @start-link="$emit('start-link', $event)"
      />
    </div>

    <div v-if="!chapters.length" class="chapter-canvas-empty">
      <span class="chapter-empty-kicker">ПУСТОЙ ХОЛСТ</span>
      <strong>Здесь появится карта этой арки</strong>
      <span>Создайте первую главу и соединяйте главы переходами.</span>
      <button type="button" :disabled="locked" @click.stop="$emit('create-first')">Создать первую главу</button>
    </div>

    <div v-if="linkingFrom" class="chapter-link-hint">
      Выберите главу, в которую ведёт переход · Esc — отменить
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ChapterGraphNode from '@/features/sessions/components/ChapterGraphNode.vue'
import {
  CHAPTER_NODE_HEIGHT,
  CHAPTER_NODE_WIDTH,
  edgeMidpoint,
  edgePath,
} from '@/features/sessions/lib/chapterGraph'

const props = defineProps({
  arcId: { type: Number, default: null },
  sessionUuid: { type: String, required: true },
  chapters: { type: Array, default: () => [] },
  edges: { type: Array, default: () => [] },
  currentChapterId: { type: [Number, String], default: null },
  linkingFrom: { type: Object, default: null },
  locked: { type: Boolean, default: false },
  spotlightChapterId: { type: [Number, String], default: null },
})
const emit = defineEmits([
  'node-click', 'edge-click', 'start-link', 'finish-link', 'preview-position',
  'save-position', 'create-first', 'view-change',
])

const viewport = ref(null)
const pan = ref({ x: 80, y: 80 })
const zoom = ref(1)
const cursorWorld = ref(null)
const gesture = ref(null)
const viewportRevision = ref(0)
let resizeObserver = null

const worldStyle = computed(() => ({ transform: `translate(${pan.value.x}px, ${pan.value.y}px) scale(${zoom.value})` }))
const gridStyle = computed(() => ({
  backgroundPosition: `${pan.value.x}px ${pan.value.y}px`,
  backgroundSize: `${24 * zoom.value}px ${24 * zoom.value}px`,
}))

const chapterMap = computed(() => new Map(props.chapters.map(chapter => [chapter.id, chapter])))
const renderedEdges = computed(() => props.edges.map(edge => {
  const from = chapterMap.value.get(edge.fromChapterId)
  const to = chapterMap.value.get(edge.toChapterId)
  return from && to ? { ...edge, raw: edge, path: edgePath(from, to), mid: edgeMidpoint(from, to) } : null
}).filter(Boolean))
const labelledEdges = computed(() => renderedEdges.value.filter(edge => edge.label))
const temporaryPath = computed(() => {
  if (!props.linkingFrom || !cursorWorld.value) return ''
  const target = {
    positionX: cursorWorld.value.x - CHAPTER_NODE_WIDTH / 2,
    positionY: cursorWorld.value.y - CHAPTER_NODE_HEIGHT / 2,
  }
  return edgePath(props.linkingFrom, target)
})
const spotlightPresentation = computed(() => {
  viewportRevision.value
  if (props.spotlightChapterId == null) return null
  const frame = safeFrame()
  if (!frame) return null
  return {
    x: (frame.left - pan.value.x) / zoom.value,
    y: (14 - pan.value.y) / zoom.value,
    scale: 1 / zoom.value,
  }
})

function viewKey() {
  return `chapter-graph:view:${props.sessionUuid}:${props.arcId}`
}

function safeFrame() {
  const rect = viewport.value?.getBoundingClientRect()
  if (!rect) return null
  const style = getComputedStyle(viewport.value)
  const left = Number.parseFloat(style.getPropertyValue('--chapter-safe-left')) || 0
  const right = Number.parseFloat(style.getPropertyValue('--chapter-safe-right')) || 0
  const usableWidth = Math.max(0, rect.width - left - right)
  return { rect, left, right, centerX: left + usableWidth / 2, centerY: rect.height / 2 }
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
  const frame = safeFrame()
  pan.value = { x: (frame?.left ?? 0) + 48, y: 80 }
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
  if (props.locked) return
  if (event.button !== 0 || event.target.closest('.chapter-node, .chapter-edge-label, .chapter-edge-hit')) return
  viewport.value.setPointerCapture(event.pointerId)
  gesture.value = {
    type: 'pan', pointerId: event.pointerId,
    startX: event.clientX, startY: event.clientY,
    panX: pan.value.x, panY: pan.value.y,
  }
}

function onNodeDown(event, chapter) {
  if (props.locked) return
  if (event.button !== 0) return
  event.stopPropagation()
  if (props.linkingFrom && props.linkingFrom.id !== chapter.id) {
    emit('finish-link', chapter)
    return
  }
  viewport.value.setPointerCapture(event.pointerId)
  const point = pointInWorld(event)
  gesture.value = {
    type: 'node', pointerId: event.pointerId, chapter,
    anchor: event.currentTarget,
    startX: event.clientX, startY: event.clientY,
    offsetX: point.x - chapter.positionX,
    offsetY: point.y - chapter.positionY,
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
  const moved = Math.hypot(event.clientX - active.startX, event.clientY - active.startY) > 4
  active.moved ||= moved
  if (active.moved) emit('preview-position', active.chapter.id, point.x - active.offsetX, point.y - active.offsetY)
}

function onPointerUp(event) {
  const active = gesture.value
  if (!active || active.pointerId !== event.pointerId) return
  if (active.type === 'pan') {
    saveView()
  } else if (active.moved) {
    const chapter = props.chapters.find(item => item.id === active.chapter.id)
    if (chapter) emit('save-position', chapter.id, chapter.positionX, chapter.positionY)
  } else {
    emit('node-click', active.chapter, active.anchor)
  }
  cancelGesture()
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
  if (props.locked) return
  const frame = safeFrame()
  if (!frame) return
  const center = { clientX: frame.rect.left + frame.centerX, clientY: frame.rect.top + frame.centerY }
  const before = pointInWorld(center)
  const next = Math.max(0.35, Math.min(1.8, zoom.value * factor))
  zoom.value = next
  pan.value = { x: frame.centerX - before.x * next, y: frame.centerY - before.y * next }
  saveView()
}

function focusChapter(chapter) {
  if (props.locked) return
  const frame = safeFrame()
  if (!frame || !chapter) return
  pan.value = {
    x: frame.centerX - (chapter.positionX + CHAPTER_NODE_WIDTH / 2) * zoom.value,
    y: frame.centerY - (chapter.positionY + CHAPTER_NODE_HEIGHT / 2) * zoom.value,
  }
  saveView()
}

function viewportCenter() {
  const frame = safeFrame()
  if (!frame) return { x: 80, y: 80 }
  return {
    x: (frame.centerX - pan.value.x) / zoom.value - CHAPTER_NODE_WIDTH / 2,
    y: (frame.centerY - pan.value.y) / zoom.value - CHAPTER_NODE_HEIGHT / 2,
  }
}

function onKey(event) {
  if (event.key === 'Escape' && props.linkingFrom) emit('start-link', null)
}

watch(() => props.arcId, () => nextTick(loadView))
watch(() => props.locked, locked => {
  if (locked) cancelGesture()
})
onMounted(() => {
  loadView()
  if (typeof ResizeObserver !== 'undefined' && viewport.value) {
    resizeObserver = new ResizeObserver(() => { viewportRevision.value += 1 })
    resizeObserver.observe(viewport.value)
  }
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  window.removeEventListener('keydown', onKey)
})

defineExpose({ zoomBy, focusChapter, viewportCenter })
</script>

<style scoped>
.chapter-canvas {
  position: relative;
  flex: 1;
  min-height: 360px;
  overflow: hidden;
  cursor: grab;
  touch-action: none;
}
.chapter-canvas--panning { cursor: grabbing; }
.chapter-canvas--linking { cursor: crosshair; }
.chapter-canvas--locked { cursor: default; }

.chapter-grid {
  position: absolute;
  inset: 0;
  background-color: var(--app-canvas-bg);
  background-image: radial-gradient(circle, var(--app-canvas-dot-color) 1px, transparent 1px);
}

.chapter-world {
  position: absolute;
  top: 0;
  left: 0;
  width: 1px;
  height: 1px;
  transform-origin: 0 0;
}

.chapter-edges {
  position: absolute;
  top: 0;
  left: 0;
  width: 1px;
  height: 1px;
  overflow: visible;
  transition: opacity 0.24s ease, filter 0.24s ease;
}

.chapter-edge-line {
  fill: none;
  stroke: color-mix(in srgb, var(--accent-soft) 62%, var(--text-muted));
  stroke-width: 2;
  pointer-events: none;
}
.chapter-edge-line--temporary { stroke-dasharray: 6 5; opacity: 0.7; }
.chapter-edge-arrow { fill: var(--accent-soft); }
.chapter-edge-hit {
  fill: none;
  stroke: transparent;
  stroke-width: 16;
  cursor: pointer;
  pointer-events: stroke;
}
.chapter-edge-hit:hover + .chapter-edge-line { stroke: var(--accent); stroke-width: 3; }

.chapter-edge-label {
  position: absolute;
  max-width: 180px;
  overflow: hidden;
  padding: 4px 8px;
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  background: color-mix(in srgb, var(--popover-bg) 92%, transparent);
  color: var(--text-2);
  font: inherit;
  font-size: 10px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  transition: opacity 0.24s ease, filter 0.24s ease, color 0.15s, border-color 0.15s;
}
.chapter-edge-label:hover { color: var(--text-1); border-color: var(--accent); }
.chapter-canvas--spotlight .chapter-edges,
.chapter-canvas--spotlight .chapter-edge-label {
  opacity: 0;
  filter: blur(6px);
  pointer-events: none;
}

.chapter-canvas-empty {
  position: absolute;
  top: 50%;
  left: calc(var(--chapter-safe-left, 0px) + (100% - var(--chapter-safe-left, 0px) - var(--chapter-safe-right, 0px)) / 2);
  width: min(360px, calc(100% - 32px));
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--text-muted);
  text-align: center;
  transform: translate(-50%, -50%);
}
.chapter-canvas-empty strong { color: var(--text-1); font-family: var(--font-display); font-size: 24px; }
.chapter-canvas-empty > span:not(.chapter-empty-kicker) { font-size: 13px; line-height: 1.45; }
.chapter-empty-kicker { color: var(--accent); font-size: 10px; font-weight: 800; letter-spacing: 0.1em; }
.chapter-canvas-empty button {
  margin-top: 8px;
  padding: 8px 14px;
  border: 0;
  border-radius: 7px;
  background: var(--accent);
  color: var(--text-on-accent);
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.chapter-link-hint {
  position: absolute;
  bottom: 18px;
  left: 50%;
  padding: 7px 12px;
  border: 1px solid color-mix(in srgb, var(--warning) 35%, transparent);
  border-radius: 7px;
  background: var(--popover-bg);
  color: var(--warning);
  font-size: 11px;
  font-weight: 700;
  transform: translateX(-50%);
  box-shadow: var(--shadow-lg);
}
</style>
