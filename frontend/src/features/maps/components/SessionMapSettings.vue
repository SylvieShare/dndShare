<template>
  <MapInspectorSection title="Основа карты">
    <BaseTile class="session-map-source" framed>
      <MapThumbnail v-if="sourceMap?.document" :map="sourceMap" :height="120" />
      <Map v-else :size="56" class="session-map-source-icon" />
      <strong>{{
        sourceMap?.name || editor.draft.source?.name || editor.draft.name
      }}</strong>
      <small class="map-hint"
        >Заготовка · изменения сохраняются только в сессии</small
      >
    </BaseTile>
    <ActionButton variant="secondary" @click="emit('switch')"
      ><template #icon><ArrowLeftRight :size="18" /></template>Переключить
      карту</ActionButton
    >
    <ActionButton variant="secondary" @click="emit('open')"
      ><template #icon><Plus :size="18" /></template>Открыть новую</ActionButton
    >
  </MapInspectorSection>
  <MapInspectorSection title="Отображение">
    <ToggleSwitch
      :model-value="playerPreview"
      label="Вид игроков"
      @update:model-value="emit('preview', $event)"
    />
    <ToggleSwitch
      :model-value="editor.draft.state.fog"
      label="Туман войны"
      @update:model-value="
        editor.change((m) => {
          m.state.fog = $event;
        })
      "
    />
    <MapDisplaySettings
      v-if="controller.display"
      :display="controller.display"
      :selected-map-id="editor.draft.id"
      :path="screenPath"
      :busy="controller.displaySaving"
      :selected-on-air="controller.display.mapId === editor.draft.id"
      @update="controller.updateDisplay"
      @frame="emit('frame')"
    />
  </MapInspectorSection>
  <MapInspectorSection title="Параметры карты"
    ><MapPropertiesPanel :editor="editor"
  /></MapInspectorSection>
  <ActionButton
    v-if="editor.conflict"
    variant="secondary"
    @click="emit('reload')"
    >Загрузить с сервера</ActionButton
  >
  <ActionButton variant="quiet" @click="emit('remove')"
    ><template #icon><Trash2 :size="18" /></template>Убрать из
    сессии</ActionButton
  >
</template>
<script setup>
import { ActionButton, BaseTile, ToggleSwitch } from "@sylvieshare/share-ui";
import { ArrowLeftRight, Map, Plus, Trash2 } from "@lucide/vue";
import MapInspectorSection from "./MapInspectorSection.vue";
import MapThumbnail from "./MapThumbnail.vue";
import MapPropertiesPanel from "./MapPropertiesPanel.vue";
import MapDisplaySettings from "./MapDisplaySettings.vue";
defineProps({
  editor: Object,
  controller: Object,
  sourceMap: Object,
  screenPath: String,
  playerPreview: Boolean,
});
const emit = defineEmits([
  "switch",
  "open",
  "preview",
  "frame",
  "remove",
  "reload",
]);
</script>
<style scoped>
.session-map-source {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
}
.session-map-source-icon {
  align-self: center;
  margin: 12px;
  color: var(--text-muted);
}
</style>
