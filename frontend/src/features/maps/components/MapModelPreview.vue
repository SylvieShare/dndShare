<template>
  <BaseTile
    class="model-preview"
    :data-preview-yaw="snapshot.view?.yaw"
    :data-wall-mode="model.wallMode"
    role="figure"
    aria-label="3D-превью параметров тайла"
  >
    <div
      ref="host"
      class="model-preview-host"
      tabindex="0"
      aria-label="3D-превью. ЛКМ — вращение, колесо — масштаб."
      @pointerdown="down"
      @pointermove="move"
      @pointerup="up"
      @pointercancel="drag = null"
      @wheel.prevent="renderer?.zoom($event.deltaY)"
      @keydown="key"
      @contextmenu.prevent
    />
    <div class="model-preview-fit">
      <ActionButton
        variant="quiet"
        aria-label="Вписать превью"
        title="Вписать превью"
        @click="renderer?.fit()"
        ><Maximize :size="18"
      /></ActionButton>
    </div>
    <div
      v-for="label in snapshot.labels"
      :key="label.key"
      class="model-preview-label"
      :data-preview-field="label.key"
      :style="{ left: `${label.x}px`, top: `${label.y}px` }"
    >
      <BaseTile
        class="model-preview-chip"
        interactive
        :color="label.color"
        :framed="activeField === label.key"
        :tint="activeField === label.key"
        role="button"
        tabindex="0"
        :aria-label="`Показать: ${label.label}`"
        @click="emit('active', label.key)"
        @keydown.enter.prevent="emit('active', label.key)"
        @keydown.space.prevent="emit('active', label.key)"
      >
        <span :style="{ color: label.color }">{{ label.caption }}</span
        ><b>{{ format(label.value) }}</b>
      </BaseTile>
    </div>
    <span
      v-for="port in snapshot.ports"
      :key="port.key"
      class="model-preview-marker"
      :data-preview-port="port.key"
      :style="{ left: `${port.x}px`, top: `${port.y}px` }"
      :title="`${port.label}: ${port.active ? 'включён' : 'выключен'}`"
    />
    <span
      v-for="slot in snapshot.sockets"
      :key="`${slot.index}:${slot.x}:${slot.y}`"
      class="model-preview-marker"
      :data-preview-slot="slot.index"
      :style="{ left: `${slot.x}px`, top: `${slot.y}px` }"
    />
    <LoadingState
      v-if="loading"
      class="model-preview-message"
      label="Загружаем 3D-превью…"
    />
    <div v-if="error" class="model-preview-message" role="alert">
      {{ error
      }}<ActionButton variant="secondary" @click="load">Повторить</ActionButton>
    </div>
    <ul class="model-preview-hint">
      <li>ЛКМ — вращение</li>
      <li>Колесо — масштаб</li>
      <li v-if="model.wallMode !== 'none'">
        Клик по {{ model.wallMode === "edge" ? "стороне" : "точке" }} — стык
      </li>
    </ul>
    <div
      class="model-preview-keyboard"
      role="toolbar"
      aria-label="Стыки и пазы превью"
    >
      <ActionButton
        v-for="port in snapshot.ports"
        :key="port.key"
        variant="secondary"
        :aria-label="`Стык: ${port.label}`"
        :aria-pressed="port.active"
        :disabled="disabled"
        @click="toggle(port.index)"
        >{{ port.label }}</ActionButton
      >
      <ActionButton
        v-for="(_, index) in model.supportSlots"
        :key="index"
        variant="secondary"
        :aria-label="`Выбрать паз ${index + 1} в превью`"
        @click="emit('slot', index)"
        >Паз {{ index + 1 }}</ActionButton
      >
    </div>
  </BaseTile>
</template>
<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { ActionButton, BaseTile, LoadingState } from "@sylvieshare/share-ui";
import { Maximize } from "@lucide/vue";
import { createModelPreview } from "../rendering/modelPreviewRenderer";
const props = defineProps({
  model: Object,
  source: Object,
  activeField: String,
  selectedSlot: Number,
  disabled: Boolean,
});
const emit = defineEmits(["active", "slot"]);
const host = ref(null),
  loading = ref(true),
  error = ref(""),
  snapshot = ref({ labels: [], ports: [], sockets: [] });
let renderer,
  observer,
  drag = null,
  epoch = 0;
const options = () => ({
  activeField: props.activeField,
  selectedSlot: props.selectedSlot,
});
async function load() {
  const id = ++epoch;
  if (!renderer || !props.source) return;
  loading.value = true;
  error.value = "";
  snapshot.value = { labels: [], ports: [], sockets: [] };
  try {
    await renderer.load(props.source, props.model, options());
  } catch (cause) {
    if (id === epoch) error.value = cause.message;
  } finally {
    if (id === epoch) loading.value = false;
  }
}
function toggle(index) {
  if (!props.disabled) props.model.wallMask ^= 1 << index;
}
function down(event) {
  if (event.button !== 0) return;
  host.value.focus();
  host.value.setPointerCapture(event.pointerId);
  drag = {
    x: event.clientX,
    y: event.clientY,
    lastX: event.clientX,
    lastY: event.clientY,
    moved: false,
  };
}
function move(event) {
  if (!drag) return;
  if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 4)
    drag.moved = true;
  if (drag.moved)
    renderer?.rotate(event.clientX - drag.lastX, event.clientY - drag.lastY);
  drag.lastX = event.clientX;
  drag.lastY = event.clientY;
}
function up(event) {
  if (!drag) return;
  if (!drag.moved) {
    const hit = renderer?.hit(event);
    if (hit?.port !== undefined) toggle(hit.port);
    if (hit?.slot !== undefined) emit("slot", hit.slot);
  }
  drag = null;
  if (host.value.hasPointerCapture(event.pointerId))
    host.value.releasePointerCapture(event.pointerId);
}
function key(event) {
  const arrows = {
    ArrowLeft: [-12, 0],
    ArrowRight: [12, 0],
    ArrowUp: [0, -12],
    ArrowDown: [0, 12],
  };
  if (arrows[event.key]) {
    event.preventDefault();
    renderer?.rotate(...arrows[event.key]);
  }
}
const format = (value) =>
  Number.isFinite(Number(value))
    ? Number(value)
        .toFixed(3)
        .replace(/\.?0+$/, "") || "0"
    : "—";
onMounted(async () => {
  try {
    renderer = createModelPreview(
      host.value,
      (frame) => {
        if (!loading.value) snapshot.value = frame;
      },
      (message) => {
        error.value = message;
      },
    );
    observer = new ResizeObserver(() => renderer.resize());
    observer.observe(host.value);
    await load();
  } catch (cause) {
    error.value = cause.message;
    loading.value = false;
  }
});
watch(() => [props.source?.id, props.source?.renderUrl], load);
watch(
  () => [props.model, props.activeField, props.selectedSlot],
  () => renderer?.update(props.model, options()),
  { deep: true },
);
onBeforeUnmount(() => {
  epoch++;
  observer?.disconnect();
  renderer?.destroy();
});
</script>
<style scoped>
.model-preview {
  overflow: hidden;
}
.model-preview-host {
  height: clamp(340px, 43vh, 480px);
  min-width: 0;
  touch-action: none;
  cursor: grab;
}
.model-preview-host:active {
  cursor: grabbing;
}
.model-preview-fit {
  position: absolute;
  top: 8px;
  right: 8px;
}
.model-preview-label {
  position: absolute;
  transform: translate(-50%, -50%);
}
.model-preview-chip {
  padding: 4px 7px;
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 10px;
  white-space: nowrap;
}
.model-preview-label b {
  font-family: var(--font-mono);
}
.model-preview-marker {
  position: absolute;
  width: 2px;
  height: 2px;
  pointer-events: none;
}
.model-preview-message {
  position: absolute;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  background: var(--surface);
}
.model-preview-hint {
  position: absolute;
  bottom: 10px;
  left: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--text-muted);
  font-size: 10px;
  line-height: 1.7;
  pointer-events: none;
}
.model-preview-keyboard {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
.model-preview-keyboard:focus-within {
  inset: auto 8px 8px;
  width: auto;
  height: auto;
  overflow: visible;
  clip-path: none;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  background: var(--surface);
}
</style>
