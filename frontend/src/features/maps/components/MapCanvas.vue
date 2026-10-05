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
    <MapTileConnections
      v-if="showConnections && selectedTile && !readonly"
      :points="connectionPoints"
      :mask="connectionMask"
      :invalid="connectionInvalid"
      @toggle="emit('connection', $event)"
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
    <p v-if="!readonly && hint" class="map-controls-hint">{{ hint }}</p>
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
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { ActionButton, LoadingState } from "@sylvieshare/share-ui";
import { createMapRenderer } from "../rendering/mapRenderer";
import { ISOMETRIC_AZIMUTH, ISOMETRIC_TILT } from "../rendering/mapCamera";
import MapTileConnections from "./MapTileConnections.vue";
import MapCanvasControls from "./MapCanvasControls.vue";
import { useMapCanvasPointer } from "../composables/useMapCanvasPointer";
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
  showConnections: Boolean,
  connectionMask: Number,
  connectionInvalid: Boolean,
  previewTile: Object,
  catalogue: Array,
  publicCode: String,
  tabletop: Boolean,
  hint: {
    type: String,
    default: "Колесо: масштаб · Alt: перемещение · ПКМ/Shift: вращение",
  },
});
const emit = defineEmits(["gesture", "view", "connection"]);
const host = ref(null),
  loading = ref(true),
  error = ref(""),
  topView = ref(false),
  connectionPoints = ref([]);
let renderer,
  dead = false,
  frame = 0;
const pointer = useMapCanvasPointer(host, props, () => renderer, emit, setView);
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
    props.catalogue,
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
function updateAnchor() {
  connectionPoints.value =
    props.showConnections && props.selectedTile
      ? renderer?.connectionPoints(props.selectedTile) || []
      : [];
}
function panArrow(key) {
  const direction = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  }[key];
  const view = renderer?.getView();
  if (!direction || !view) return;
  const top = props.tabletop || props.document.kind !== "tiles";
  const yaw = ((top ? view.rotation : view.azimuth) * Math.PI) / 180,
    pitch = ((top ? 90 : view.tilt) * Math.PI) / 180,
    dx = (direction[0] * 48) / view.cellPixels,
    dy = (direction[1] * 48) / (view.cellPixels * Math.sin(pitch));
  setView({
    ...view,
    fit: false,
    x: view.x + dx * Math.cos(yaw) + dy * Math.sin(yaw),
    y: view.y - dx * Math.sin(yaw) + dy * Math.cos(yaw),
  });
}
onMounted(async () => {
  try {
    const r = await createMapRenderer(
      host.value,
      (message) => {
        error.value = message;
      },
      updateAnchor,
    );
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
  fit,
  getView: () => renderer?.getView(),
  setView,
  pointAt: pointer.pointAt,
  centerPoint: () => {
    const view = renderer?.getView();
    return view && { x: view.x, y: view.y };
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
  cursor: default;
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
  max-width: min(480px, calc(100% - 270px));
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
