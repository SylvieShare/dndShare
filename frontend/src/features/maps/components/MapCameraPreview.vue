<template>
  <div class="map-camera-preview" :aria-busy="loading">
    <img v-if="url" :src="url" alt="Вид из камеры" /><span v-else>{{
      error || "Готовим вид камеры…"
    }}</span>
  </div>
</template>
<script setup>
import { onBeforeUnmount, ref, watch } from "vue";
import { requestMapSnapshot } from "../rendering/mapSnapshots";
const props = defineProps({ editor: Object, camera: Object }),
  url = ref(""),
  loading = ref(false),
  error = ref("");
let controller, timer;
watch(
  () => [
    props.camera?.view,
    props.editor.draft.document,
    props.editor.catalogue,
  ],
  () => {
    clearTimeout(timer);
    controller?.abort();
    timer = setTimeout(async () => {
      if (!props.camera) return;
      const request = new AbortController();
      controller = request;
      loading.value = true;
      error.value = "";
      try {
        const blob = await requestMapSnapshot(
          props.editor.draft.document,
          request.signal,
          {
            catalogue: props.editor.catalogue,
            view: props.camera.view,
            forceLod: true,
          },
        );
        if (request.signal.aborted) return;
        if (url.value) URL.revokeObjectURL(url.value);
        url.value = URL.createObjectURL(blob);
      } catch (cause) {
        if (!request.signal.aborted) error.value = "Превью недоступно";
      } finally {
        if (!request.signal.aborted) loading.value = false;
      }
    }, 180);
  },
  { deep: true, immediate: true },
);
onBeforeUnmount(() => {
  clearTimeout(timer);
  controller?.abort();
  if (url.value) URL.revokeObjectURL(url.value);
});
</script>
<style scoped>
.map-camera-preview {
  aspect-ratio: 16/9;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  display: grid;
  place-items: center;
  font-size: 12px;
  color: var(--text-muted);
}
img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
