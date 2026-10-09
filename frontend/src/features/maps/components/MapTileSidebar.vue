<template>
  <MapSidebar
    ref="sidebar"
    v-model:tab="tab"
    class="map-tile-sidebar"
    :tabs="tabs"
    aria-label="Каталог плиток"
    tabs-label="Боковые вкладки редактора"
    @select="emit('tab', $event)"
    @resize="emit('resize', $event)"
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
      @focus="selectArea"
    />
    <MapPropertiesPanel v-else-if="tab === 'settings'" :editor="editor" />
    <MapLightingPanel
      v-else-if="tab === 'lights'"
      :editor="editor"
      @place-light="(kind, event) => emit('place-light', kind, event)"
    />
    <slot v-else :name="tab" :editor="editor" />
  </MapSidebar>
</template>
<script setup>
import { computed, ref } from "vue";
import { Layers, Box, Group, Lightbulb, Settings } from "@lucide/vue";
import MapSidebar from "./MapSidebar.vue";
import MapPropertiesPanel from "./MapPropertiesPanel.vue";
import MapLightingPanel from "./MapLightingPanel.vue";
import MapAreasPanel from "./MapAreasPanel.vue";
import MapObjectPalette from "./MapObjectPalette.vue";
import MapTilePalette from "./MapTilePalette.vue";
const props = defineProps({
  editor: Object,
  sessionMode: Boolean,
  extraTabs: { type: Array, default: () => [] },
});
const emit = defineEmits([
  "model",
  "drag-tile",
  "collection",
  "object",
  "drag-object",
  "tab",
  "place-light",
  "resize",
]);
const sidebar = ref(null);
function selectArea(id) {
  emit("tab", "areas");
  props.editor.selectArea(id);
}
defineExpose({
  openArea(id) {
    sidebar.value?.openTab("areas");
    props.editor.selectArea(id);
  },
});
const tab = ref("tiles");
const tabs = computed(() => [
  { key: "tiles", label: "Плитки", icon: Layers },
  { key: "lights", label: "Освещение", icon: Lightbulb },
  { key: "objects", label: "Объекты", icon: Box },
  { key: "areas", label: "Области", icon: Group },
  ...(!props.sessionMode
    ? [{ key: "settings", label: "Настройки", icon: Settings }]
    : []),
  ...props.extraTabs,
]);
</script>
