<template>
  <div class="session-map-toolbars" data-tutorial="session-map-toolbar">
    <BaseTile framed class="session-map-toolbar">
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
      framed
      v-if="controller.display"
      class="session-map-toolbar"
      data-tutorial="session-map-broadcast"
    >
      <ActionButton
        icon-only
        :variant="controller.display.visible ? 'primary' : 'quiet'"
        :disabled="controller.displaySaving"
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
        ><template #icon
          ><Radio v-if="controller.display.visible" :size="18" /><RadioTower
            v-else
            :size="18" /></template
      ></ActionButton>
      <ValueSelect
        :model-value="source"
        :options="sources"
        :disabled="controller.displaySaving"
        aria-label="Камера трансляции"
        @update:model-value="emit('source', $event)"
      />
      <ActionButton
        v-if="editor.draft.document.kind === 'tiles'"
        variant="quiet"
        :disabled="controller.displaySaving"
        @click="emit('capture')"
        ><template #icon><Focus :size="17" /></template>Отобразить текущий
        вид</ActionButton
      >
      <ActionButton
        icon-only
        variant="quiet"
        aria-label="Экран карты"
        @click="openScreen"
        ><template #icon><ExternalLink :size="17" /></template
      ></ActionButton>
      <ActionButton
        icon-only
        variant="quiet"
        :aria-label="playerPreview ? 'Вид ведущего' : 'Вид игроков'"
        @click="emit('preview', !playerPreview)"
        ><template #icon><Eye :size="17" /></template
      ></ActionButton>
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
import {
  ArrowLeftRight,
  Map,
  Radio,
  RadioTower,
  Focus,
  ExternalLink,
  Eye,
  Settings,
} from "@lucide/vue";
import MapDisplaySettings from "./MapDisplaySettings.vue";
const calibration = ref(false);
const props = defineProps({
  editor: Object,
  controller: Object,
  screenPath: String,
  playerPreview: Boolean,
});
const emit = defineEmits(["switch", "source", "capture", "preview"]);
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
function openScreen() {
  window.open(props.screenPath, "_blank", "noopener,noreferrer");
}
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
  pointer-events: auto;
  max-width: 100%;
}
.session-map-toolbar-divider {
  height: 22px;
  width: 1px;
  background: var(--border-color);
}
.session-map-toolbar :deep(.inline-edit) {
  max-width: 260px;
}
.session-map-toolbar :deep(select) {
  max-width: 180px;
}
@media (prefers-reduced-motion: reduce) {
  .session-map-toolbars {
    transition: none;
  }
}
</style>
