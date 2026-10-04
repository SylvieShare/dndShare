<template>
  <div
    class="map-canvas"
    :class="{ 'map-canvas--draw': tool !== 'pan' && !readonly }"
    @contextmenu.prevent
  >
    <div
      ref="host"
      class="map-canvas-surface"
      tabindex="0"
      aria-label="Поле карты. Колесо — масштаб, Alt — перемещение, правая кнопка или Shift — вращение обзора."
      @pointerdown="down"
      @pointermove="move"
      @pointerup="up"
      @pointercancel="cancel"
      @wheel.prevent="wheel"
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
    <div v-if="!readonly" class="map-canvas-controls">
      <ActionButton
        variant="secondary"
        title="Уменьшить"
        aria-label="Уменьшить"
        @click="zoom(0.8)"
        ><Minus :size="16"
      /></ActionButton>
      <ActionButton variant="secondary" title="Показать всю карту" @click="fit"
        ><Scan :size="16" /> Вписать</ActionButton
      >
      <ActionButton
        variant="secondary"
        title="Увеличить"
        aria-label="Увеличить"
        @click="zoom(1.25)"
        ><Plus :size="16"
      /></ActionButton>
      <ActionButton
        v-if="document.kind === 'tiles'"
        variant="secondary"
        :title="topView ? 'Изометрический вид' : 'Вид сверху'"
        @click="toggleView"
      >
        <Box :size="16" />{{ topView ? "Изометрия" : "Сверху" }}
      </ActionButton>
      <ActionButton
        variant="secondary"
        title="Повернуть обзор на 90°"
        aria-label="Повернуть обзор на 90°"
        @click="rotateView"
        ><RotateCw :size="16"
      /></ActionButton>
    </div>
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
import { Box, Minus, Plus, RotateCw, Scan } from "@lucide/vue";
import { createMapRenderer } from "../rendering/mapRenderer";
import { ISOMETRIC_AZIMUTH, ISOMETRIC_TILT } from "../rendering/mapCamera";
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
  previewTile: Object,
  catalogue: Array,
  publicCode: String,
  tabletop: Boolean,
});
const emit = defineEmits(["gesture", "view"]);
const host = ref(null),
  loading = ref(true),
  error = ref(""),
  topView = ref(false);
let renderer,
  dead = false,
  frame = 0,
  drag = null;
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
function rotateView() {
  const view = renderer?.getView();
  if (view)
    setView({
      ...view,
      rotation: (view.rotation + 90) % 360,
      azimuth: (view.azimuth + 90) % 360,
    });
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
function down(event) {
  if (props.readonly || !renderer || drag) return;
  host.value.focus({ preventScroll: true });
  host.value.setPointerCapture(event.pointerId);
  drag = {
    id: event.pointerId,
    orbit: event.button === 2 || event.shiftKey,
    pan: event.button === 1 || event.altKey || props.tool === "pan",
    screen: { x: event.clientX, y: event.clientY },
    point: renderer.world(event),
    view: renderer.getView(),
  };
  if (!drag.pan && !drag.orbit)
    emit("gesture", {
      phase: "start",
      point: drag.point,
      hit: renderer.pick(event),
      event,
    });
}
function move(event) {
  if (!renderer || props.readonly) return;
  const point = renderer.world(event);
  if (!drag) {
    emit("gesture", { phase: "hover", point, event });
    return;
  }
  if (event.pointerId !== drag.id) return;
  if (drag.orbit) {
    topView.value = false;
    setView({
      ...drag.view,
      fit: false,
      azimuth:
        (drag.view.azimuth + (event.clientX - drag.screen.x) * 0.4) % 360,
      tilt: Math.max(
        20,
        Math.min(90, drag.view.tilt + (event.clientY - drag.screen.y) * 0.25),
      ),
    });
  } else if (drag.pan) {
    const v = renderer.getView();
    setView({
      ...v,
      fit: false,
      x: v.x + drag.point.x - point.x,
      y: v.y + drag.point.y - point.y,
    });
  } else emit("gesture", { phase: "move", point, event });
}
function up(event) {
  if (!drag || event.pointerId !== drag.id) return;
  if (!drag.pan && !drag.orbit)
    emit("gesture", { phase: "end", point: renderer.world(event), event });
  drag = null;
  host.value.releasePointerCapture(event.pointerId);
}
function cancel(event) {
  if (drag && !drag.pan && !drag.orbit)
    emit("gesture", { phase: "cancel", event });
  drag = null;
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
defineExpose({ fit, getView: () => renderer?.getView(), setView });
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
.map-canvas-surface :deep(canvas) {
  display: block;
}
.map-canvas-controls {
  position: absolute;
  bottom: 16px;
  left: 16px;
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: 10px;
  background: var(--surface);
  border: 1px solid var(--border-strong);
}
.map-credit {
  position: absolute;
  bottom: 8px;
  right: 12px;
  padding: 3px 6px;
  border-radius: 4px;
  font-size: 10px;
  background: var(--surface);
  color: var(--text-muted);
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
