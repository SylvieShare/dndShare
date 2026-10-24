<template>
  <div ref="root" class="item-model-preview" data-swipe-back-ignore>
    <div ref="stage" class="item-model-stage">
      <div
        ref="host"
        class="item-model-canvas"
        tabindex="0"
        role="img"
        :aria-label="`3D-модель: ${item.name}. Перетаскивание — вращение, колесо или два пальца — масштаб. Стрелки и +/− доступны с клавиатуры.`"
        :data-model-ready="ready"
        :data-model-yaw="view.yaw"
        :data-model-zoom="view.zoom"
      />
      <div v-if="loading" class="item-model-message">
        <LoadingIndicator label="Загружаем 3D-модель…" />
      </div>
      <div v-else-if="error" class="item-model-message" role="alert">
        <span>{{ error }}</span
        ><ActionButton variant="secondary" @click="load"
          >Повторить</ActionButton
        >
      </div>
      <div
        v-if="ready"
        class="item-model-tools"
        role="toolbar"
        aria-label="Просмотр 3D-модели"
      >
        <ActionButton
          variant="quiet"
          icon-only
          aria-label="Приблизить модель"
          title="Приблизить"
          @click="renderer?.zoom(-180)"
          ><Plus :size="18"
        /></ActionButton>
        <ActionButton
          variant="quiet"
          icon-only
          aria-label="Отдалить модель"
          title="Отдалить"
          @click="renderer?.zoom(180)"
          ><Minus :size="18"
        /></ActionButton>
        <ActionButton
          variant="quiet"
          icon-only
          aria-label="Вписать модель"
          title="Вписать модель"
          @click="renderer?.fit()"
          ><Maximize :size="18"
        /></ActionButton>
      </div>
    </div>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { ActionButton, LoadingIndicator } from "@sylvieshare/share-ui";
import { Plus, Minus, Maximize } from "@lucide/vue";
import { fetchGet } from "@/shared/api/http";
import { createModelViewer } from "@/shared/model3d/modelViewerRenderer";

const props = defineProps({
  item: { type: Object, required: true },
  frame: Function,
});
const root = ref(null),
  stage = ref(null),
  host = ref(null),
  loading = ref(true),
  ready = ref(false),
  error = ref(""),
  view = ref({});
let renderer,
  observer,
  request,
  serial = 0,
  dead = false;
function resize() {
  if (dead || !host.value) return;
  const target = props.frame?.(),
    box = root.value.getBoundingClientRect();
  const frame = target?.getBoundingClientRect();
  Object.assign(
    stage.value.style,
    frame
      ? {
          left: `${frame.left - box.left}px`,
          width: `${frame.width}px`,
          "--model-tools-bottom": `${Math.max(12, box.bottom - frame.bottom + 12)}px`,
        }
      : {
          left: "16px",
          width: `${Math.max(1, box.width - 32)}px`,
          "--model-tools-bottom": "12px",
        },
  );
  renderer?.resize();
}
async function load() {
  const id = ++serial;
  request?.abort();
  request = new AbortController();
  loading.value = true;
  ready.value = false;
  error.value = "";
  try {
    if (!renderer)
      renderer = createModelViewer(host.value, (snapshot) => {
        view.value = snapshot;
      });
    resize();
    const model = await fetchGet(`/items/${props.item.id}/model`, {
      signal: request.signal,
    });
    if (dead || id !== serial) return;
    await renderer.load(model, request.signal);
    if (!dead && id === serial) ready.value = true;
  } catch (cause) {
    if (!dead && id === serial && cause.name !== "AbortError")
      error.value = "Не удалось загрузить 3D-модель.";
  } finally {
    if (!dead && id === serial) loading.value = false;
  }
}
onMounted(async () => {
  await nextTick();
  if (dead) return;
  observer = new ResizeObserver(resize);
  observer.observe(root.value);
  const frame = props.frame?.();
  if (frame) observer.observe(frame);
  await load();
});
watch([() => props.item.id, () => props.item.modelId], () => {
  if (renderer) load();
});
onBeforeUnmount(() => {
  dead = true;
  serial++;
  request?.abort();
  observer?.disconnect();
  renderer?.destroy();
});
</script>

<style scoped>
.item-model-preview {
  position: absolute;
  inset: 0;
}
.item-model-stage {
  position: absolute;
  top: 0;
  bottom: 0;
}
.item-model-canvas {
  position: absolute;
  inset: 0;
  cursor: grab;
  touch-action: none;
  outline-offset: -3px;
}
.item-model-canvas.is-dragging {
  cursor: grabbing;
}
.item-model-canvas :deep(canvas) {
  display: block;
}
.item-model-canvas:focus-visible {
  outline: 2px solid var(--accent);
}
.item-model-message {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 12px;
  color: var(--text-1);
}
.item-model-tools {
  position: absolute;
  right: 0;
  bottom: var(--model-tools-bottom, 12px);
  display: flex;
  gap: 2px;
  background: color-mix(in srgb, var(--surface) 88%, transparent);
  border-radius: 10px;
  pointer-events: auto;
}
</style>
