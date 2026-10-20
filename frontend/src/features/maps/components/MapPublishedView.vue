<template>
  <section class="published-map">
    <WorkspaceHeader
      ><template #identity
        ><ActionButton variant="quiet" @click="router.push({ name: 'Maps' })"
          ><template #icon><ArrowLeft :size="16" /></template
          >Карты</ActionButton
        >
        <div>
          <h1>{{ map.name }}</h1>
          <small
            ><LockKeyhole :size="12" />Опубликованная заготовка ·
            {{ map.author }}</small
          >
        </div></template
      ><template #actions
        ><ActionButton
          v-if="!map.owned"
          variant="secondary"
          :disabled="busy"
          @click="subscription"
          >{{ map.subscribed ? "Отписаться" : "Подписаться" }}</ActionButton
        ><ActionButton
          v-if="map.owned || map.subscribed"
          :disabled="busy"
          @click="copy"
          ><template #icon><Copy :size="16" /></template>Создать
          копию</ActionButton
        ></template
      ></WorkspaceHeader
    >
    <div v-if="error" class="map-error" role="alert">{{ error }}</div>
    <MapCanvas :document="map.document" master readonly />
  </section>
</template>
<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { ActionButton } from "@sylvieshare/share-ui";
import { ArrowLeft, Copy, LockKeyhole } from "@lucide/vue";
import WorkspaceHeader from "@/shared/ui/WorkspaceHeader.vue";
import { copyMap, subscribeMap } from "@/shared/api/mapsApi";
import MapCanvas from "./MapCanvas.vue";
const props = defineProps({ map: Object }),
  emit = defineEmits(["update"]);
const router = useRouter(),
  busy = ref(false),
  error = ref("");
async function act(operation) {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    await operation();
  } catch (cause) {
    error.value = cause.message;
  } finally {
    busy.value = false;
  }
}
function subscription() {
  return act(async () =>
    emit("update", await subscribeMap(props.map.id, !props.map.subscribed)),
  );
}
function copy() {
  return act(async () => {
    const result = await copyMap(props.map.id);
    await router.push({ name: "MapEditor", query: { id: result.id } });
  });
}
</script>
<style scoped>
.published-map {
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
h1 {
  font: 22px var(--font-display);
  margin: 0 0 4px;
}
small {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--text-muted);
  font-size: 11px;
}
.published-map > .map-canvas {
  flex: 1;
  min-height: 0;
}
</style>
