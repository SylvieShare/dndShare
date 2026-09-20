<template>
  <main class="map-screen" @pointermove="showControls">
    <MapCanvas
      v-if="snapshot?.map && snapshot.display.visible"
      :key="snapshot.map.id"
      :document="snapshot.map.document"
      :state="snapshot.map.state"
      :camera="snapshot.display.camera"
      readonly
    />
    <div v-else-if="error && !snapshot" class="map-screen-error" role="alert">{{ error }}</div>
    <div v-if="(!connected || error) && snapshot" class="map-screen-status" role="status">
      {{ error || 'Восстанавливаем связь…' }}
    </div>
    <ActionButton
      v-if="controls"
      class="map-screen-fullscreen"
      variant="secondary"
      @click="fullscreen"
      ><Maximize :size="18" />Полный экран</ActionButton
    >
  </main>
</template>
<script setup>
import { onBeforeUnmount, ref } from 'vue';
import { useRoute } from 'vue-router';
import { ActionButton } from '@sylvieshare/share-ui';
import { Maximize } from '@lucide/vue';
import MapCanvas from '../components/MapCanvas.vue';
import { useMapSync } from '../composables/useMapSync';
import { getPublicMap } from '@/shared/api/mapsApi';
const code = String(useRoute().params.code),
  snapshot = ref(null),
  error = ref(''),
  controls = ref(false);
let timer;
const { connected } = useMapSync(
  `/api/public/sessions/${encodeURIComponent(code)}/map-events`,
  async () => {
    try {
      snapshot.value = await getPublicMap(code);
      error.value = '';
    } catch (cause) {
      if ([401, 403, 404].includes(cause.status)) snapshot.value = null;
      error.value =
        cause.status === 404
          ? 'Карта сессии недоступна. Проверьте ссылку.'
          : 'Не удалось подключиться к карте';
      throw cause;
    }
  },
);
function showControls() {
  controls.value = true;
  clearTimeout(timer);
  timer = setTimeout(() => {
    controls.value = false;
  }, 2500);
}
async function fullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    error.value = 'Включите полноэкранный режим в меню браузера';
  }
}
onBeforeUnmount(() => clearTimeout(timer));
</script>
<style scoped>
.map-screen {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: var(--map-screen-void);
}
.map-screen :deep(.map-canvas) {
  border-radius: 0;
}
.map-screen-fullscreen {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: var(--surface);
}
.map-screen-status {
  position: fixed;
  top: 12px;
  right: 12px;
  background: var(--surface);
  color: var(--warning);
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 11px;
}
.map-screen-error {
  display: grid;
  place-items: center;
  height: 100%;
  color: var(--text-muted);
}
</style>
