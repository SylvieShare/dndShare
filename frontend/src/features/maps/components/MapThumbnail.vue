<template>
  <div ref="host" class="map-thumbnail" :aria-busy="loading">
    <img v-if="url" :src="url" alt="" loading="lazy" />
    <LoadingState v-else-if="loading" label="Готовим превью…" />
    <span v-else class="map-hint">Превью недоступно</span>
  </div>
</template>
<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { LoadingState } from "@sylvieshare/share-ui";
import { requestMapSnapshot } from "../rendering/mapSnapshots";
const props = defineProps({ document: { type: Object, required: true } });
const host = ref(null),
  url = ref(""),
  loading = ref(true);
let observer,
  controller,
  visible = false;
function clear() {
  controller?.abort();
  if (url.value) URL.revokeObjectURL(url.value);
  url.value = "";
}
async function load() {
  clear();
  loading.value = true;
  const request = new AbortController();
  controller = request;
  try {
    const blob = await requestMapSnapshot(props.document, request.signal);
    if (!request.signal.aborted) url.value = URL.createObjectURL(blob);
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
        load();
      }
    },
    { rootMargin: "200px" },
  );
  observer.observe(host.value);
});
watch(
  () => props.document,
  () => {
    if (visible) load();
  },
  { deep: true },
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
