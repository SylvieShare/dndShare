<template>
  <div class="session-map-toolbars" data-tutorial="session-map-toolbar">
    <BaseTile
      surface="glass"
      framed
      class="session-map-toolbar"
      role="toolbar"
      aria-label="Карта и трансляция"
    >
      <div class="session-map-toolbar-group session-map-toolbar-map">
        <Map :size="18" />
        <InlineEdit
          :model-value="editor.draft.name"
          label="Название карты сессии"
          :maxlength="160"
          required
          @confirm="editor.change((m) => (m.name = String($event).trim()))"
        />
        <ActionButton
          variant="quiet"
          layout="stacked"
          aria-label="Сменить"
          @click="emit('switch')"
          ><template #icon><ArrowLeftRight :size="20" /></template
          >Сменить</ActionButton
        >
      </div>
      <template v-if="controller.display">
        <span class="session-map-toolbar-divider" role="separator" />
        <div
          class="session-map-toolbar-group session-map-toolbar-broadcast"
          data-tutorial="session-map-broadcast"
        >
          <ActionButton
            icon-only
            :variant="controller.display.visible ? 'primary' : 'quiet'"
            :disabled="controller.displaySaving"
            :aria-pressed="controller.display.visible"
            :aria-label="
              controller.display.visible
                ? 'Остановить трансляцию'
                : 'Начать трансляцию'
            "
            @click="
              controller.updateDisplay({
                mapId: editor.draft.id,
                visible: !controller.display.visible,
              })
            "
            ><template #icon><MonitorUp :size="20" /></template
          ></ActionButton>
          <ActionButton
            variant="quiet"
            class="session-map-current-camera"
            aria-label="Перейти к виду камеры трансляции"
            :title="cameraName"
            @click="emit('view')"
          >
            <template #icon><Camera :size="18" /></template>
            <span class="session-map-camera-caption"
              ><small>Камера трансляции</small
              ><strong>{{ cameraName }}</strong></span
            >
          </ActionButton>
          <ActionButton
            v-if="editor.draft.document.kind === 'tiles'"
            variant="quiet"
            layout="stacked"
            :disabled="controller.displaySaving"
            aria-label="Отобразить текущий вид"
            title="Отобразить текущий вид"
            @click="emit('capture')"
            ><template #icon><Focus :size="20" /></template>Текущий
            вид</ActionButton
          >
          <ActionButton
            v-else
            icon-only
            variant="quiet"
            aria-label="Калибровка экрана"
            @click="calibration = true"
            ><template #icon><Settings :size="17" /></template
          ></ActionButton>
        </div>
      </template>
    </BaseTile>
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
      :selected-map-id="editor.draft.id"
      :busy="controller.displaySaving"
      :selected-on-air="controller.display.mapId === editor.draft.id"
      @update="controller.updateDisplay"
      @frame="emit('capture')"
    />
  </AppModalFrame>
</template>
<script setup>
import { computed, ref } from "vue";
import {
  ActionButton,
  AppModalFrame,
  BaseTile,
  InlineEdit,
} from "@sylvieshare/share-ui";
import {
  ArrowLeftRight,
  Map,
  MonitorUp,
  Focus,
  Settings,
  Camera,
} from "@lucide/vue";
import MapDisplaySettings from "./MapDisplaySettings.vue";
const calibration = ref(false);
const props = defineProps({
  editor: Object,
  controller: Object,
  screenPath: String,
});
const emit = defineEmits(["switch", "view", "capture"]);
const cameraName = computed(() => {
  const camera = props.controller.display?.camera;
  return (
    props.editor.draft.document.cameras?.find((c) => c.id === camera?.sceneId)
      ?.name || (camera?.view ? "Зафиксированный вид" : "Вся карта")
  );
});
</script>
<style scoped>
.session-map-toolbars {
  position: absolute;
  top: 12px;
  left: calc(var(--map-overlay-left, 0px) + 12px);
  right: 12px;
  pointer-events: none;
  z-index: 4;
  transition: left 0.25s ease;
}
.session-map-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  box-sizing: border-box;
  min-height: 64px;
  width: max-content;
  max-width: 100%;
  pointer-events: auto;
}
.session-map-toolbar-group {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.session-map-toolbar-map > svg {
  flex: none;
}
.session-map-toolbar-map {
  flex: 0 1 auto;
}
.session-map-toolbar-broadcast {
  flex: 1 1 auto;
}
.session-map-toolbar-divider {
  height: 32px;
  width: 1px;
  background: var(--border-strong);
  flex: none;
}
.session-map-toolbar :deep(.share-inline-edit) {
  min-width: 0;
  max-width: 220px;
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
}
.session-map-camera-caption strong {
  line-height: 16px;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (max-width: 760px) {
  .session-map-toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
  }
  .session-map-toolbar-divider {
    width: 100%;
    height: 1px;
  }
  .session-map-toolbar-map > :deep(.share-inline-edit) {
    flex: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .session-map-toolbars {
    transition: none;
  }
}
</style>
