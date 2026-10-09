<template>
  <div
    ref="host"
    class="map-thumbnail"
    :style="{ height: `${height}px` }"
    :aria-busy="loading"
  >
    <img v-if="url" :src="url" alt="" loading="lazy" />
    <LoadingState v-else-if="loading" label="Готовим превью…" />
    <span v-else class="map-hint">Превью недоступно</span>
  </div>
</template>
<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { LoadingState } from "@sylvieshare/share-ui";
import { ensureStoredMapPreview } from "../lib/mapStoredPreviews";
const props = defineProps({
  map: { type: Object, required: true },
  height: { type: Number, default: 180 },
});
const host = ref(null),
  url = ref(props.map.previewUrl || ""),
  loading = ref(!props.map.previewUrl);
let observer,
  controller,
  visible = false;
function clear() {
  controller?.abort();
}
async function load() {
  clear();
  loading.value = true;
  const request = new AbortController();
  controller = request;
  try {
    const stored = await ensureStoredMapPreview(props.map);
    if (!request.signal.aborted) url.value = stored;
  } catch {
    /* The card stays usable when GPU or model loading fails. */
  } finally {
    if (!request.signal.aborted) loading.value = false;
  }
}
onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        visible = true;
        observer.disconnect();
        if (!url.value) load();
      }
    },
    { rootMargin: "200px" },
  );
  observer.observe(host.value);
});
watch(
  () => [props.map.id, props.map.previewSignature, props.map.previewUrl],
  () => {
    clear();
    url.value = props.map.previewUrl || "";
    loading.value = !url.value;
    if (visible && !url.value) load();
  },
);
onBeforeUnmount(() => {
  observer?.disconnect();
  clear();
});
</script>
<style scoped>
.map-thumbnail {
  height: 180px;
  background: var(--bg);
  border-radius: 9px;
  overflow: hidden;
  display: grid;
  place-items: center;
}
.map-thumbnail img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
}
</style>
