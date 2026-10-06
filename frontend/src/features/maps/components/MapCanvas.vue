<template>
  <div
    class="map-canvas"
    :class="{
      'map-canvas--draw': !['pan', 'select'].includes(tool) && !readonly,
      'map-canvas--select': tool === 'select' && !readonly,
      'map-canvas--hover': !!hoveredTile,
    }"
    @contextmenu.prevent
  >
    <div
      ref="host"
      class="map-canvas-surface"
      tabindex="0"
      aria-label="Поле карты. Колесо — масштаб, Alt — перемещение, правая кнопка или Shift — вращение обзора."
      @pointerdown="pointer.down"
      @pointermove="pointer.move"
      @pointerup="pointer.up"
      @pointercancel="pointer.cancel"
      @pointerleave="pointer.leave"
      @wheel.prevent="wheel"
    />
    <div
      v-if="screenSelection"
      class="map-selection-marquee"
      :style="{
        left: `${screenSelection.left}px`,
        top: `${screenSelection.top}px`,
        width: `${screenSelection.width}px`,
        height: `${screenSelection.height}px`,
      }"
      aria-hidden="true"
    />
    <LoadingState
      v-if="loading"
      class="map-canvas-message"
      label="Подготавливаем карту…"
    />
    <div v-if="error" class="map-canvas-message" role="alert">
      {{ error
      }}<ActionButton variant="secondary" @click="retry"
        >Повторить загрузку</ActionButton
      >
    </div>
    <MapCanvasControls
      v-if="!readonly"
      :kind="document.kind"
      :top-view="topView"
      @zoom="zoom"
      @fit="fit"
      @toggle-view="toggleView"
    />
    <ul
      v-if="!readonly && hintLines.length"
      class="map-controls-hint"
      aria-label="Управление картой"
    >
      <li v-for="(line, index) in hintLines" :key="index">{{ line }}</li>
    </ul>
    <div v-if="document.credit" class="map-credit">
      <a
        v-if="document.credit.source"
        :href="document.credit.source"
        target="_blank"
        rel="noopener noreferrer"
        >{{ document.credit.author }}</a
      >
      <span v-else>{{ document.credit.author }}</span> ·
      {{ document.credit.license }}
    </div>
  </div>
</template>
<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { ActionButton, LoadingState } from "@sylvieshare/share-ui";
import { createMapRenderer } from "../rendering/mapRenderer";
import { ISOMETRIC_AZIMUTH, ISOMETRIC_TILT } from "../rendering/mapCamera";
import MapCanvasControls from "./MapCanvasControls.vue";
import { useMapCanvasPointer } from "../composables/useMapCanvasPointer";
import { useCameraPan } from "../composables/useCameraPan";
const props = defineProps({
  document: { type: Object, required: true },
  state: Object,
  master: Boolean,
  readonly: Boolean,
  tool: { type: String, default: "pan" },
  camera: Object,
  selectedZone: String,
  showZones: Boolean,
  selection: Object,
  selectedObject: String,
  selectedToken: String,
  selectedTile: String,
  selectedTiles: Array,
  screenSelection: Object,
  hoveredTile: String,
  previewTile: Object,
  previewObject: Object,
  showAnchors: Boolean,
  catalogue: Array,
  placementModel: String,
  placementObject: String,
  surfacePlacement: Boolean,
  placementRotation: Number,
  placementHint: Object,
  publicCode: String,
  tabletop: Boolean,
  hint: {
    type: [String, Array],
    default: "Колесо: масштаб · Alt: перемещение · ПКМ/Shift: вращение",
  },
});
const hintLines = computed(() =>
  Array.isArray(props.hint) ? props.hint : (props.hint || "").split(/\s*·\s*/),
);
const emit = defineEmits(["gesture", "view", "camera-move"]);
const host = ref(null),
  loading = ref(true),
  error = ref(""),
  topView = ref(false);
let renderer,
  dead = false,
  frame = 0;
const pointer = useMapCanvasPointer(host, props, () => renderer, emit, setView);
const keyboardPan = useCameraPan(
  () => renderer?.getView(),
  setView,
  () => props.tabletop || props.document.kind !== "tiles",
  () => emit("camera-move"),
);
function redraw() {
  if (frame || !renderer) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    renderer.update(props.document, props.state, props).catch((cause) => {
      error.value = cause.message;
    });
  });
}
watch(
  () => [
    props.document,
    props.state,
    props.selectedZone,
    props.showZones,
    props.selection,
    props.selectedObject,
    props.selectedToken,
    props.master,
    props.selectedTile,
    props.selectedTiles,
    props.hoveredTile,
    props.previewTile,
    props.previewObject,
    props.showAnchors,
    props.catalogue,
    props.placementObject,
    props.surfacePlacement,
  ],
  redraw,
  { deep: true },
);
watch(
  () => props.camera,
  (c) => {
    if (c) renderer?.camera(c);
  },
  { deep: true },
);
function setView(view) {
  renderer?.camera(view);
  topView.value = renderer?.getView().tilt === 90;
  emit("view", renderer?.getView());
}
function fit() {
  const view = renderer?.getView();
  if (view) setView({ ...view, fit: true });
}
async function retry() {
  error.value = "";
  try {
    await renderer?.update(props.document, props.state, props);
  } catch (cause) {
    error.value = cause.message;
  }
}
function toggleView() {
  const view = renderer?.getView();
  if (view) {
    const top = !topView.value;
    setView({
      ...view,
      tilt: top ? 90 : ISOMETRIC_TILT,
      azimuth: view.rotation + (top ? 0 : ISOMETRIC_AZIMUTH),
    });
  }
}
function zoom(factor) {
  const view = renderer?.getView();
  if (view)
    setView({
      ...view,
      fit: false,
      cellPixels: Math.max(8, Math.min(400, view.cellPixels * factor)),
    });
}
function wheel(event) {
  if (props.readonly || !renderer) return;
  const before = renderer.world(event);
  zoom(Math.exp(-event.deltaY * 0.001));
  const after = renderer.world(event),
    view = renderer.getView();
  setView({
    ...view,
    x: view.x + before.x - after.x,
    y: view.y + before.y - after.y,
  });
}
function panArrow(key) {
  keyboardPan.down(key);
}
onMounted(async () => {
  try {
    const r = await createMapRenderer(host.value, (message) => {
      error.value = message;
    });
    if (dead) {
      r.destroy();
      return;
    }
    renderer = r;
    await r.update(props.document, props.state, props);
    if (props.camera) r.camera(props.camera);
  } catch (cause) {
    error.value = `Не удалось запустить отрисовку WebGL: ${cause.message}`;
  } finally {
    loading.value = false;
  }
});
onBeforeUnmount(() => {
  dead = true;
  cancelAnimationFrame(frame);
  renderer?.destroy();
});
defineExpose({
  panArrow,
  releaseArrow: keyboardPan.up,
  stopCamera: keyboardPan.stop,
  fit,
  getView: () => renderer?.getView(),
  setView,
  pointAt: pointer.pointAt,
  centerPoint: () => {
    const view = renderer?.getView();
    if (!view) return null;
    const bounds = host.value.getBoundingClientRect();
    return pointer.pointAt({
      clientX: bounds.x + bounds.width / 2,
      clientY: bounds.y + bounds.height / 2,
    });
  },
  focus: () => host.value?.focus({ preventScroll: true }),
});
</script>
<style scoped>
.map-canvas {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 240px;
  overflow: hidden;
  border-radius: 12px;
  background: var(--bg);
}
.map-canvas-surface {
  position: absolute;
  inset: 0;
  cursor: grab;
  touch-action: none;
  outline: none;
}
.map-canvas-surface:active {
  cursor: grabbing;
}
.map-canvas--draw .map-canvas-surface {
  cursor: crosshair;
}
.map-canvas--select .map-canvas-surface {
  cursor: grab;
}
.map-canvas--select .map-canvas-surface:active {
  cursor: grabbing;
}
.map-canvas--hover .map-canvas-surface {
  cursor: pointer;
}
.map-selection-marquee {
  position: absolute;
  border: 1px solid var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  pointer-events: none;
}
.map-canvas-surface :deep(canvas) {
  display: block;
}
.map-credit {
  position: absolute;
  top: 8px;
  right: 12px;
  padding: 3px 6px;
  border-radius: 4px;
  font-size: 10px;
  background: var(--surface);
  color: var(--text-muted);
}
.map-controls-hint {
  position: absolute;
  bottom: 16px;
  left: 16px;
  max-width: min(420px, calc(100% - 270px));
  list-style: none;
  margin: 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--surface);
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.5;
  pointer-events: none;
}
.map-credit a {
  color: var(--text-2);
}
.map-canvas-message {
  position: absolute;
  inset: 20%;
  display: grid;
  place-items: center;
  padding: 20px;
  background: var(--surface);
  color: var(--text-1);
  border-radius: 12px;
}
</style>

<style scoped>
.map-controls-hint li {
  white-space: nowrap;
}
@media (max-width: 760px) {
  .map-controls-hint {
    bottom: 76px;
    max-width: calc(100% - 32px);
    font-size: 10px;
  }
}
</style>
