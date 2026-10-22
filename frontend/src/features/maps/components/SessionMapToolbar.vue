<template>
  <div class="session-map-toolbars" data-tutorial="session-map-toolbar">
    <BaseTile surface="glass" framed class="session-map-toolbar">
      <Map :size="18" />
      <InlineEdit
        :model-value="editor.draft.name"
        label="Название карты сессии"
        :maxlength="160"
        required
        @confirm="editor.change((m) => (m.name = String($event).trim()))"
      />
      <span class="session-map-toolbar-divider" />
      <ActionButton variant="quiet" @click="emit('switch')"
        ><template #icon><ArrowLeftRight :size="16" /></template
        >Сменить</ActionButton
      >
    </BaseTile>
    <BaseTile
      surface="glass"
      framed
      v-if="controller.display"
      class="session-map-toolbar"
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
      <ValueSelect
        :model-value="source"
        :options="sources"
        :disabled="controller.displaySaving"
        class="session-map-camera-select"
        aria-label="Камера трансляции"
        @update:model-value="emit('source', $event)"
      />
      <ActionButton
        v-if="editor.draft.document.kind === 'tiles'"
        variant="quiet"
        :disabled="controller.displaySaving"
        aria-label="Отобразить текущий вид"
        title="Отобразить текущий вид"
        @click="emit('capture')"
        ><template #icon><Focus :size="17" /></template
        ><span class="session-map-capture-label"
          >Отобразить текущий вид</span
        ></ActionButton
      >
      <ActionButton
        v-if="editor.draft.document.kind === 'image'"
        icon-only
        variant="quiet"
        aria-label="Калибровка экрана"
        @click="calibration = true"
        ><template #icon><Settings :size="17" /></template
      ></ActionButton>
    </BaseTile>
  </div>
  <AppModalFrame
    v-if="calibration"
    title="Экран карты"
    :width="440"
    @close="calibration = false"
    ><MapDisplaySettings
      :display="controller.display"
      :path="screenPath"
      :selected-map-id="editor.draft.id"
      :busy="controller.displaySaving"
      :selected-on-air="controller.display.mapId === editor.draft.id"
      @update="controller.updateDisplay"
      @frame="emit('capture')"
  /></AppModalFrame>
</template>
<script setup>
import { computed, ref } from "vue";
import {
  ActionButton,
  AppModalFrame,
  BaseTile,
  InlineEdit,
  ValueSelect,
} from "@sylvieshare/share-ui";
import { ArrowLeftRight, Map, MonitorUp, Focus, Settings } from "@lucide/vue";
import MapDisplaySettings from "./MapDisplaySettings.vue";
const calibration = ref(false);
const props = defineProps({
  editor: Object,
  controller: Object,
  screenPath: String,
});
const emit = defineEmits(["switch", "source", "capture"]);
const source = computed(
  () =>
    props.controller.display.camera.sceneId ||
    (props.controller.display.camera.view ? "virtual" : "overview"),
);
const sources = computed(() => [
  { value: "overview", label: "Вся карта" },
  ...(props.editor.draft.document.cameras || []).map((c) => ({
    value: c.id,
    label: c.name,
  })),
  ...(source.value === "virtual"
    ? [{ value: "virtual", label: "Зафиксированный вид" }]
    : []),
]);
</script>
<style scoped>
.session-map-toolbars {
  position: absolute;
  top: 12px;
  left: calc(var(--map-overlay-left, 0px) + 12px);
  right: 12px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  flex-wrap: wrap;
  pointer-events: none;
  z-index: 4;
  transition: left 0.25s ease;
}
.session-map-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  box-sizing: border-box;
  height: 64px;
  flex-shrink: 0;
  pointer-events: auto;
  max-width: 100%;
}
.session-map-toolbar-divider {
  height: 22px;
  width: 1px;
  background: var(--border);
  flex-shrink: 0;
}
.session-map-toolbar :deep(.share-inline-edit) {
  min-width: 0;
  flex-shrink: 1;
  max-width: 260px;
}
.session-map-camera-select {
  min-width: 100px;
  flex-shrink: 1;
  max-width: 180px;
}
@media (max-width: 760px) {
  .session-map-capture-label {
    display: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .session-map-toolbars {
    transition: none;
  }
}
</style>
