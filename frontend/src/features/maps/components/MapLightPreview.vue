<template>
  <div class="map-light-preview" :data-preview-state="status.state">
    <canvas
      ref="target"
      :class="{ 'is-ready': status.captured }"
      aria-label="Кадр карты вокруг источника света"
    />
    <Lightbulb
      v-if="!status.captured"
      :size="54"
      :style="{ color: entry.color }"
      aria-hidden="true"
    />
    <span
      v-if="status.captured"
      class="map-light-preview-centre"
      :style="{ color: entry.color }"
      aria-hidden="true"
    />
    <small v-if="status.state !== 'live'">
      {{
        status.state === "unavailable"
          ? "Не удалось обновить кадр"
          : status.captured
            ? "Последний полный кадр"
            : status.state === "outside"
              ? "Область превью вне кадра · двойной клик — найти"
              : "Ожидаем кадр карты…"
      }}
    </small>
  </div>
</template>
<script setup>
import { onMounted, onBeforeUnmount, ref } from "vue";
import { Lightbulb } from "@lucide/vue";
const props = defineProps({ editor: Object, entry: Object });
const target = ref(null),
  status = ref({ state: "waiting", captured: false });
let stop;
onMounted(() => {
  stop = props.editor.observeLightFrame?.(
    target.value,
    props.entry.id,
    (value) => (status.value = value),
  );
});
onBeforeUnmount(() => stop?.());
</script>
<style scoped>
.map-light-preview {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  position: relative;
}
canvas {
  position: absolute;
  inset: 0;
  visibility: hidden;
  object-fit: cover;
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
canvas.is-ready {
  visibility: visible;
}
small {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 6px;
  font-size: 10px;
  text-align: center;
  color: var(--text-muted);
  background: var(--surface);
}
.map-light-preview-centre {
  position: absolute;
  width: 8px;
  height: 8px;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  border: 1px solid currentColor;
  border-radius: 50%;
  box-shadow: 0 0 0 2px var(--surface);
  pointer-events: none;
}
</style>
