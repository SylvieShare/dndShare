<template>
  <MapSidebar
    ref="sidebar"
    v-model:tab="tab"
    class="map-tile-sidebar"
    :tabs="tabs"
    aria-label="Каталог плиток"
    tabs-label="Боковые вкладки редактора"
    @select="emit('tab', $event)"
  >
    <MapTilePalette
      v-if="tab === 'tiles'"
      :editor="editor"
      @collection="emit('collection', $event)"
      compact
      draggable
      @model="(id, event) => emit('model', id, event)"
      @drag-tile="(id, event) => emit('drag-tile', id, event)"
    />
    <MapObjectPalette
      v-else-if="tab === 'objects'"
      :editor="editor"
      draggable
      @object="(id, event) => emit('object', id, event)"
      @drag-object="(id, event) => emit('drag-object', id, event)"
    />
    <MapAreasPanel
      v-else-if="tab === 'areas'"
      :editor="editor"
      :focus-area="focusArea"
    />
    <MapPropertiesPanel v-else-if="tab === 'settings'" :editor="editor" />
    <MapLightingPanel
      v-else
      :editor="editor"
      @place-light="(kind, event) => emit('place-light', kind, event)"
    />
  </MapSidebar>
</template>
<script setup>
import { computed, nextTick, ref } from "vue";
import { Layers, Box, Group, Lightbulb, Settings } from "@lucide/vue";
import MapSidebar from "./MapSidebar.vue";
import MapPropertiesPanel from "./MapPropertiesPanel.vue";
import MapLightingPanel from "./MapLightingPanel.vue";
import MapAreasPanel from "./MapAreasPanel.vue";
import MapObjectPalette from "./MapObjectPalette.vue";
import MapTilePalette from "./MapTilePalette.vue";
const props = defineProps({ editor: Object });
const emit = defineEmits([
  "model",
  "drag-tile",
  "collection",
  "object",
  "drag-object",
  "tab",
  "place-light",
]);
const sidebar = ref(null),
  focusArea = ref("");
defineExpose({
  openArea(id) {
    focusArea.value = "";
    sidebar.value?.openTab("areas");
    nextTick(() => {
      focusArea.value = id;
    });
  },
});
const tab = ref(
  props.editor.draft.document.kind === "tiles" ? "tiles" : "settings",
);
const tabs = computed(() => [
  ...(props.editor.draft.document.kind === "tiles"
    ? [{ key: "tiles", label: "Плитки", icon: Layers }]
    : []),
  { key: "lights", label: "Освещение", icon: Lightbulb },
  { key: "objects", label: "Объекты", icon: Box },
  { key: "areas", label: "Области", icon: Group },
  { key: "settings", label: "Настройки", icon: Settings },
]);
</script>
