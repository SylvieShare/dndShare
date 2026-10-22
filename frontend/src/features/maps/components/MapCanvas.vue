<template>
  <div
    class="map-canvas"
    :class="{
      'map-canvas--draw': !['pan', 'select'].includes(tool) && !readonly,
      'map-canvas--select': tool === 'select' && !readonly,
      'map-canvas--hover': !!hoveredTile || !!hoveredObject,
    }"
    @contextmenu.prevent
  >
    <div
      ref="host"
      class="map-canvas-surface"
      tabindex="0"
      aria-label="Поле карты. Колесо — масштаб, Alt — перемещение, правая кнопка или Shift — вращение обзора."
      @pointerdown="pointerDown"
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
    <div v-if="error" class="map-canvas-message" role="alert">
      {{ error
      }}<ActionButton variant="secondary" @click="retry"
        >Повторить загрузку</ActionButton
      >
    </div>
    <div class="map-canvas-corner">
      <MapDownloadManager :progress="downloads" @retry="retry" />
      <MapCanvasControls
        v-if="!readonly"
        :top-view="topView"
        :flat="document.kind === 'image'"
        @zoom="zoom"
        @fit="fit"
        @toggle-view="toggleView"
      />
    </div>
    <MapControlsHint v-if="!readonly && hintLines.length" :lines="hintLines" />
  </div>
</template>
<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { ActionButton } from "@sylvieshare/share-ui";
import { createMapRenderer } from "../rendering/mapRenderer";
import { ISOMETRIC_AZIMUTH, ISOMETRIC_TILT } from "../rendering/mapCamera";
import {
  focusViewportOffset,
  useCameraFocus,
} from "../composables/useCameraFocus";
import { createPerformanceBridge } from "../lib/performanceBridge";
import MapControlsHint from "./MapControlsHint.vue";
import MapCanvasControls from "./MapCanvasControls.vue";
import MapDownloadManager from "./MapDownloadManager.vue";
import { useMapCanvasPointer } from "../composables/useMapCanvasPointer";
import { useCanvasUpdates } from "../composables/useCanvasUpdates";
import { useCameraPan } from "../composables/useCameraPan";
const props = defineProps({
  document: { type: Object, required: true },
  editCameras: Boolean,
  selectedCamera: String,
  previewCamera: Object,
  broadcastView: Object,
  forceLod: Boolean,
  placementCamera: Boolean,
  state: Object,
  master: Boolean,
  active: { type: Boolean, default: true },
  readonly: Boolean,
  tool: { type: String, default: "pan" },
  camera: Object,
  selectedZone: String,
  showZones: Boolean,
  selection: Object,
  selectedObject: String,
  selectedObjects: Array,
  selectedLight: String,
  selectedDecal: String,
  previewDecal: Object,
  placementDecal: Boolean,
  hoveredLight: String,
  previewLight: Object,
  placementLight: Boolean,
  editLights: Boolean,
  selectedToken: String,
  selectionColor: String,
  selectedTile: String,
  selectedTiles: Array,
  screenSelection: Object,
  hoveredTile: String,
  hoveredObject: String,
  previewTile: Object,
  holdToDrag: Boolean,
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
  areaMode: { type: String, default: "hide" },
  occlusions: Function,
  hint: {
    type: [String, Array],
    default: "Колесо: масштаб · Alt: перемещение · ПКМ/Shift: вращение",
  },
});
const hintLines = computed(() =>
  Array.isArray(props.hint) ? props.hint : (props.hint || "").split(/\s*·\s*/),
);
const emit = defineEmits(["gesture", "view", "camera-move", "resources"]);
const host = ref(null),
  downloads = ref(null),
  error = ref(""),
  topView = ref(false);
const performanceBridge = createPerformanceBridge();
let renderer,
  dead = false;
const pointer = useMapCanvasPointer(host, props, () => renderer, emit, setView);
const keyboardPan = useCameraPan(
  () => renderer?.getView(),
  setView,
  () => props.tabletop,
  () => emit("camera-move"),
);
const { syncActive, options } = useCanvasUpdates(
  props,
  () => renderer,
  (message) => {
    error.value = message;
  },
  (active) => {
    if (!active) {
      cameraFocus.stop();
      keyboardPan.stop();
    }
  },
);
const cameraFocus = useCameraFocus(() => renderer?.getView(), applyView);
function pointerDown(event) {
  cameraFocus.stop();
  pointer.down(event);
}
function setView(view) {
  cameraFocus.stop();
  applyView(view);
}
function applyView(view) {
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
    await renderer?.retry();
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
    const r = await createMapRenderer(
      host.value,
      (message) => {
        error.value = message;
      },
      undefined,
      (progress) => {
        downloads.value = progress;
        emit("resources", progress.memory);
      },
    );
    if (dead) {
      r.destroy();
      return;
    }
    renderer = r;
    syncActive(false);
    performanceBridge.attach(r);
    await r.update(props.document, props.state, options());
    if (props.camera) r.camera(props.camera);
  } catch (cause) {
    error.value = `Не удалось запустить отрисовку WebGL: ${cause.message}`;
  }
});
onBeforeUnmount(() => {
  dead = true;
  cameraFocus.stop();
  performanceBridge.destroy();
  renderer?.destroy();
});
defineExpose({
  captureCamera: () => renderer?.captureCamera(),
  observePerformance: performanceBridge.observe,
  panArrow,
  focusAt: (point, obstacle) => {
    keyboardPan.stop();
    cameraFocus.focusAt(
      point,
      focusViewportOffset(
        host.value?.getBoundingClientRect(),
        obstacle ?? props.occlusions?.(),
      ),
    );
  },
  observeAreaFrame: (target, id, changed) =>
    renderer?.observeAreaFrame(target, id, changed),
  observeLightFrame: (target, id, changed) =>
    renderer?.observeLightFrame(target, id, changed),
  releaseArrow: keyboardPan.up,
  stopCamera: keyboardPan.stop,
  fit,
  getView: () => renderer?.getView(),
  setView,
  pointAt: (event) => {
    const target =
      event && document.elementFromPoint(event.clientX, event.clientY);
    return target && host.value?.contains(target)
      ? pointer.pointAt(event)
      : null;
  },
  centerPoint: () => {
    const view = renderer?.getView();
    if (!view) return null;
    const bounds = host.value.getBoundingClientRect();
    const offset = focusViewportOffset(bounds, props.occlusions?.());
    return pointer.pointAt({
      clientX: bounds.x + bounds.width / 2 + offset.x,
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
.map-canvas-corner {
  position: absolute;
  right: 16px;
  bottom: 16px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  max-width: calc(100% - 32px);
  pointer-events: none;
}
.map-canvas-corner > * {
  pointer-events: auto;
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
