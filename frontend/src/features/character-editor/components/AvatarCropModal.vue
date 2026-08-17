<template>
  <AppModalFrame title="Кадрирование портрета" width="620px" :body-scroll="false" @close="$emit('close')">
    <div class="avatar-crop-body">
      <div
        ref="stage"
        class="avatar-crop-stage"
        :style="stageStyle"
        @pointerdown="startDrag"
        @pointermove="moveDrag"
        @pointerup="endDrag"
        @pointercancel="endDrag"
      >
        <img
          ref="image"
          :src="src"
          alt="Кадрируемый портрет"
          draggable="false"
          :style="imageStyle"
          @load="measure"
          @error="loadError = true"
        />
        <span class="avatar-crop-grid" aria-hidden="true" />
      </div>

      <label class="avatar-crop-zoom">
        <span>Масштаб</span>
        <input v-model.number="zoom" type="range" min="1" max="3" step="0.01" @input="clampOffset" />
      </label>
      <p v-if="loadError" class="avatar-crop-error">Не удалось открыть изображение для кадрирования.</p>
      <p v-else class="avatar-crop-hint">Перетаскивай изображение внутри рамки и настрой масштаб.</p>
    </div>

    <template #footer>
      <FormActionButtons
        submit-text="Применить"
        loading-text="Обработка…"
        :loading="processing"
        :can-submit="ready && !loadError"
        @cancel="$emit('close')"
        @submit="applyCrop"
      />
    </template>
  </AppModalFrame>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { AppModalFrame, FormActionButtons } from '@sylvieshare/share-ui'

const props = defineProps({
  src: { type: String, required: true },
  aspect: { type: Number, default: 1 },
})
const emit = defineEmits(['close', 'crop'])

const stage = ref(null)
const image = ref(null)
const zoom = ref(1)
const offset = ref({ x: 0, y: 0 })
const natural = ref({ width: 0, height: 0 })
const ready = ref(false)
const loadError = ref(false)
const processing = ref(false)
let drag = null
let resizeObserver = null

const safeAspect = computed(() => Math.min(2.4, Math.max(0.55, Number(props.aspect) || 1)))
const stageStyle = computed(() => ({ aspectRatio: String(safeAspect.value) }))

function stageSize() {
  return {
    width: stage.value?.clientWidth || 1,
    height: stage.value?.clientHeight || 1,
  }
}

function baseRenderedSize() {
  const box = stageSize()
  const imageAspect = natural.value.width / Math.max(1, natural.value.height)
  if (imageAspect >= safeAspect.value) {
    return { width: box.height * imageAspect, height: box.height }
  }
  return { width: box.width, height: box.width / imageAspect }
}

function offsetBounds() {
  const box = stageSize()
  const base = baseRenderedSize()
  return {
    x: Math.max(0, (base.width * zoom.value - box.width) / 2),
    y: Math.max(0, (base.height * zoom.value - box.height) / 2),
  }
}

function clampOffset() {
  if (!ready.value) return
  const bounds = offsetBounds()
  offset.value = {
    x: Math.max(-bounds.x, Math.min(bounds.x, offset.value.x)),
    y: Math.max(-bounds.y, Math.min(bounds.y, offset.value.y)),
  }
}

const imageStyle = computed(() => {
  const imageAspect = natural.value.width / Math.max(1, natural.value.height)
  return {
    width: imageAspect >= safeAspect.value ? 'auto' : '100%',
    height: imageAspect >= safeAspect.value ? '100%' : 'auto',
    transform: `translate3d(${offset.value.x}px, ${offset.value.y}px, 0) scale(${zoom.value})`,
  }
})

function measure() {
  natural.value = {
    width: image.value?.naturalWidth || 0,
    height: image.value?.naturalHeight || 0,
  }
  ready.value = natural.value.width > 0 && natural.value.height > 0
  nextTick(clampOffset)
}

function startDrag(event) {
  if (!ready.value || event.button !== 0) return
  event.currentTarget.setPointerCapture?.(event.pointerId)
  drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, origin: { ...offset.value } }
}

function moveDrag(event) {
  if (!drag || drag.pointerId !== event.pointerId) return
  offset.value = {
    x: drag.origin.x + event.clientX - drag.x,
    y: drag.origin.y + event.clientY - drag.y,
  }
  clampOffset()
}

function endDrag(event) {
  if (drag?.pointerId !== event.pointerId) return
  event.currentTarget.releasePointerCapture?.(event.pointerId)
  drag = null
}

async function applyCrop() {
  if (!ready.value || processing.value) return
  processing.value = true
  try {
    const box = stageSize()
    const base = baseRenderedSize()
    const rendered = { width: base.width * zoom.value, height: base.height * zoom.value }
    const left = (box.width - rendered.width) / 2 + offset.value.x
    const top = (box.height - rendered.height) / 2 + offset.value.y
    const source = {
      x: Math.max(0, -left / rendered.width * natural.value.width),
      y: Math.max(0, -top / rendered.height * natural.value.height),
      width: Math.min(natural.value.width, box.width / rendered.width * natural.value.width),
      height: Math.min(natural.value.height, box.height / rendered.height * natural.value.height),
    }

    const outputWidth = Math.min(1024, Math.max(512, Math.round(source.width)))
    const outputHeight = Math.max(1, Math.round(outputWidth / safeAspect.value))
    const canvas = document.createElement('canvas')
    canvas.width = outputWidth
    canvas.height = outputHeight
    const context = canvas.getContext('2d')
    if (!context) throw new Error('canvas unavailable')
    context.drawImage(image.value, source.x, source.y, source.width, source.height, 0, 0, outputWidth, outputHeight)
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(value => value ? resolve(value) : reject(new Error('crop failed')), 'image/webp', 0.9)
    })
    emit('crop', blob)
  } catch {
    loadError.value = true
  } finally {
    processing.value = false
  }
}

watch(zoom, clampOffset)

onMounted(() => {
  resizeObserver = new ResizeObserver(clampOffset)
  if (stage.value) resizeObserver.observe(stage.value)
})
onBeforeUnmount(() => resizeObserver?.disconnect())
</script>

<style scoped>
.avatar-crop-body { display: flex; flex-direction: column; gap: 14px; min-height: 0; }
.avatar-crop-stage {
  position: relative;
  width: min(100%, 500px, 42vh);
  max-width: 500px;
  margin: 0 auto;
  overflow: hidden;
  border: 1px solid var(--border-strong);
  border-radius: var(--r-lg);
  background: var(--surface-raised);
  cursor: grab;
  touch-action: none;
  user-select: none;
}
.avatar-crop-stage:active { cursor: grabbing; }
.avatar-crop-stage img {
  position: absolute;
  top: 50%;
  left: 50%;
  display: block;
  max-width: none;
  transform-origin: center;
  translate: -50% -50%;
  pointer-events: none;
}
.avatar-crop-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(to right, transparent 33.1%, color-mix(in srgb, var(--text-on-accent) 30%, transparent) 33.2%, color-mix(in srgb, var(--text-on-accent) 30%, transparent) 33.5%, transparent 33.6%, transparent 66.4%, color-mix(in srgb, var(--text-on-accent) 30%, transparent) 66.5%, color-mix(in srgb, var(--text-on-accent) 30%, transparent) 66.8%, transparent 66.9%),
    linear-gradient(to bottom, transparent 33.1%, color-mix(in srgb, var(--text-on-accent) 30%, transparent) 33.2%, color-mix(in srgb, var(--text-on-accent) 30%, transparent) 33.5%, transparent 33.6%, transparent 66.4%, color-mix(in srgb, var(--text-on-accent) 30%, transparent) 66.5%, color-mix(in srgb, var(--text-on-accent) 30%, transparent) 66.8%, transparent 66.9%);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--text-on-accent) 22%, transparent);
}
.avatar-crop-zoom { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 12px; color: var(--text-2); font-size: 12px; }
.avatar-crop-zoom input { width: 100%; accent-color: var(--accent); }
.avatar-crop-hint, .avatar-crop-error { margin: 0; color: var(--text-muted); font-size: 12px; text-align: center; }
.avatar-crop-error { color: var(--danger); }
</style>
