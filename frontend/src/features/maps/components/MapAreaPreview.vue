<template>
  <div
    class="map-area-preview"
    role="figure"
    aria-label="Превью содержимого области"
    :data-preview-state="state"
  >
    <canvas
      ref="target"
      :class="{ ready: state === 'ready' }"
      aria-label="Только элементы выбранной области"
    />
    <span v-if="state !== 'ready'" class="map-hint">{{
      empty
        ? "Область пуста"
        : state === "unavailable"
          ? "Не удалось создать превью"
          : "Загружаем модели области…"
    }}</span>
  </div>
</template>
<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
const props = defineProps({ editor: Object, area: Object });
const target = ref(null),
  state = ref("waiting");
const empty = computed(
  () => !props.area.tileIds.length && !props.area.objectIds.length,
);
let stop;
onMounted(() => {
  stop = props.editor.observeAreaFrame?.(
    target.value,
    props.area.id,
    (value) => (state.value = value),
  );
});
onBeforeUnmount(() => stop?.());
</script>
<style scoped>
.map-area-preview {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: grid;
  place-items: center;
}
canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  visibility: hidden;
}
canvas.ready {
  visibility: visible;
}
.map-hint {
  padding: 12px;
  text-align: center;
}
</style>
