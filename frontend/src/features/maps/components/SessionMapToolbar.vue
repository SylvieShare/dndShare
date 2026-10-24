<template>
  <div
    v-if="controller.display"
    class="session-map-broadcast"
    role="toolbar"
    aria-label="Трансляция карты"
    data-tutorial="session-map-broadcast"
  >
    <ActionButton
      icon-only
      :variant="selectedOnAir ? 'primary' : 'quiet'"
      :aria-pressed="selectedOnAir"
      :aria-label="
        selectedOnAir
          ? 'Остановить трансляцию'
          : `Транслировать карту «${activeMap?.name || ''}»`
      "
      :disabled="controller.displaySaving || !activeMap"
      @click="
        controller.updateDisplay(
          toggleMapBroadcast(controller.display, activeMap),
        )
      "
      ><template #icon><MonitorUp :size="20" /></template
    ></ActionButton>
    <ActionButton
      variant="quiet"
      class="session-map-current-camera"
      :disabled="!broadcastMap"
      aria-label="Перейти к виду камеры трансляции"
      :title="cameraName"
      @click="emit('view')"
    >
      <template #icon><Camera :size="18" /></template>
      <span class="session-map-camera-caption"
        ><small>{{
          controller.display.visible
            ? `В эфире: ${broadcastMap?.name || "Карта"}`
            : "Трансляция выключена"
        }}</small
        ><strong>{{ cameraName }}</strong></span
      >
    </ActionButton>
    <ActionButton
      v-if="activeMap?.document.kind === 'tiles'"
      variant="quiet"
      layout="stacked"
      :disabled="controller.displaySaving || !editor"
      aria-label="Отобразить текущий вид"
      title="Отобразить текущий вид"
      @click="emit('capture')"
      ><template #icon><Focus :size="20" /></template>Текущий вид</ActionButton
    >
    <ActionButton
      v-else-if="activeMap?.document.kind === 'image'"
      icon-only
      variant="quiet"
      aria-label="Калибровка экрана"
      @click="calibration = true"
      ><template #icon><Settings :size="17" /></template
    ></ActionButton>
  </div>
  <AppModalFrame
    v-if="calibration"
    title="Экран карты"
    :width="440"
    @close="calibration = false"
  >
    <MapDisplaySettings
      :display="controller.display"
      :path="screenPath"
      :selected-map-id="activeMap?.id || ''"
      :busy="controller.displaySaving"
      :selected-on-air="controller.display.mapId === activeMap?.id"
      @update="controller.updateDisplay"
      @frame="emit('capture')"
    />
  </AppModalFrame>
</template>
<script setup>
import { computed, ref } from "vue";
import { ActionButton, AppModalFrame } from "@sylvieshare/share-ui";
import { MonitorUp, Focus, Settings, Camera } from "@lucide/vue";
import MapDisplaySettings from "./MapDisplaySettings.vue";
import { toggleMapBroadcast } from "../lib/sessionMapBroadcast";
const calibration = ref(false);
const props = defineProps({
  editor: Object,
  controller: Object,
  screenPath: String,
});
const emit = defineEmits(["view", "capture"]);
const activeMap = computed(
  () => props.editor?.draft || props.controller.selected,
);
const broadcastMap = computed(() =>
  activeMap.value?.id === props.controller.display?.mapId
    ? activeMap.value
    : props.controller.maps.find(
        (m) => m.id === props.controller.display?.mapId,
      ),
);
const selectedOnAir = computed(
  () =>
    !!props.controller.display?.visible &&
    props.controller.display.mapId === activeMap.value?.id,
);
const cameraName = computed(() => {
  const camera = props.controller.display?.camera;
  return (
    broadcastMap.value?.document.cameras?.find((c) => c.id === camera?.sceneId)
      ?.name || (camera?.view ? "Зафиксированный вид" : "Вся карта")
  );
});
</script>
<style scoped>
.session-map-broadcast {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.session-map-current-camera {
  min-width: 0;
  max-width: 220px;
  flex: 1 1 auto;
}
.session-map-current-camera :deep(> span) {
  min-width: 0;
}
.session-map-camera-caption {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  text-align: left;
}
.session-map-camera-caption small {
  line-height: 12px;
  font-size: 10px;
  color: var(--text-muted);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.session-map-camera-caption strong {
  line-height: 16px;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
