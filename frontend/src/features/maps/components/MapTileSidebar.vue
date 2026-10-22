<template>
  <MapSidebar
    ref="sidebar"
    v-model:tab="tab"
    class="map-tile-sidebar"
    :tabs="tabs"
    aria-label="Каталог плиток"
    tabs-label="Боковые вкладки редактора"
    @select="emit('tab', $event)"
    @resize="(width, rail) => emit('resize', width, rail)"
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
    <MapDecalPalette
      v-else-if="tab === 'decals'"
      :editor="editor"
      @place="emit('place-decal', $event)"
    />
    <MapAreasPanel
      v-else-if="tab === 'areas'"
      :editor="editor"
      @focus="selectArea"
    />
    <MapCamerasPanel v-else-if="tab === 'cameras'" :editor="editor" />
    <MapPropertiesPanel v-else-if="tab === 'settings'" :editor="editor" />
    <MapPerformancePanel v-else-if="tab === 'performance'" :editor="editor" />
    <MapLightingPanel
      v-else-if="tab === 'lights'"
      :editor="editor"
      @place-light="(kind, event) => emit('place-light', kind, event)"
    />
    <slot v-else :name="tab" :editor="editor" />
  </MapSidebar>
</template>
<script setup>
import MapDecalPalette from "./MapDecalPalette.vue";
import { computed, ref, watch } from "vue";
import {
  Layers,
  Box,
  Group,
  Lightbulb,
  Settings,
  Gauge,
  Sticker,
  Camera,
} from "@lucide/vue";
import MapCamerasPanel from "./MapCamerasPanel.vue";
import MapSidebar from "./MapSidebar.vue";
import MapPropertiesPanel from "./MapPropertiesPanel.vue";
import MapPerformancePanel from "./MapPerformancePanel.vue";
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
  "place-decal",
  "resize",
]);
const sidebar = ref(null);
function selectArea(id) {
  emit("tab", "areas");
  props.editor.selectArea(id);
}
defineExpose({
  bounds: () => sidebar.value?.bounds(),
  openArea(id) {
    sidebar.value?.openTab("areas");
    props.editor.selectArea(id);
  },
});
const image = computed(() => props.editor.draft.document.kind === "image");
const tab = ref(image.value ? "settings" : "tiles");
const tabs = computed(() => [
  ...props.extraTabs,
  ...(!image.value
    ? [
        {
          key: "tiles",
          label: "Плитки",
          icon: Layers,
          divider: props.extraTabs.length > 0,
          dividerLabel: "Вкладки редактора",
        },
        { key: "objects", label: "Объекты", icon: Box },
        { key: "decals", label: "Декали", icon: Sticker },
        {
          key: "lights",
          label: "Освещение",
          icon: Lightbulb,
          divider: true,
          dividerLabel: "Сцена",
        },
        { key: "areas", label: "Области", icon: Group },
        { key: "cameras", label: "Камеры", icon: Camera },
      ]
    : []),
  {
    key: "settings",
    label: "Настройки",
    icon: Settings,
    divider: !image.value || props.extraTabs.length > 0,
    dividerLabel: "Инструменты",
  },
  {
    key: "performance",
    label: "Производительность",
    shortLabel: "Нагрузка",
    icon: Gauge,
  },
]);
watch(tabs, (list) => {
  if (!list.some((t) => t.key === tab.value)) tab.value = list[0].key;
});
</script>
