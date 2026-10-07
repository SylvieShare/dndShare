<template>
  <aside
    class="map-tile-sidebar"
    :class="{ 'map-tile-sidebar--collapsed': collapsed }"
    aria-label="Каталог плиток"
    @contextmenu.prevent
  >
    <nav class="map-sidebar-tabs" aria-label="Боковые вкладки редактора">
      <ActionButton
        icon-only
        :variant="tab === 'tiles' ? 'primary' : 'quiet'"
        v-if="editor.draft.document.kind === 'tiles'"
        aria-label="Плитки"
        title="Плитки"
        @click="openTab('tiles')"
        ><template #icon><Layers :size="22" /></template
      ></ActionButton>
      <ActionButton
        icon-only
        :variant="tab === 'lights' ? 'primary' : 'quiet'"
        aria-label="Освещение"
        title="Освещение"
        @click="openTab('lights')"
        ><template #icon><Lightbulb :size="22" /></template
      ></ActionButton>
      <ActionButton
        icon-only
        :variant="tab === 'objects' ? 'primary' : 'quiet'"
        aria-label="Объекты"
        title="Объекты"
        @click="openTab('objects')"
        ><template #icon><Box :size="22" /></template
      ></ActionButton>
      <ActionButton
        icon-only
        :variant="tab === 'areas' ? 'primary' : 'quiet'"
        aria-label="Области"
        title="Области"
        @click="openTab('areas')"
        ><template #icon><Group :size="22" /></template
      ></ActionButton>
      <ActionButton
        icon-only
        :variant="tab === 'zones' ? 'primary' : 'quiet'"
        aria-label="Зоны"
        title="Зоны"
        @click="openTab('zones')"
        ><template #icon><Square :size="22" /></template
      ></ActionButton>
      <ActionButton
        icon-only
        :variant="tab === 'settings' ? 'primary' : 'quiet'"
        aria-label="Настройки"
        title="Настройки"
        @click="openTab('settings')"
        ><template #icon><Settings :size="22" /></template
      ></ActionButton>
    </nav>
    <div v-show="!collapsed" class="map-sidebar-panel">
      <div class="map-tile-sidebar-heading">
        <strong v-if="!collapsed">{{ labels[tab] }}</strong>
        <ActionButton
          variant="quiet"
          :aria-label="
            collapsed ? 'Развернуть список плиток' : 'Свернуть список плиток'
          "
          :title="
            collapsed ? 'Развернуть список плиток' : 'Свернуть список плиток'
          "
          :aria-expanded="!collapsed"
          @click="collapsed = !collapsed"
        >
          <PanelLeftOpen v-if="collapsed" :size="20" /><PanelLeftClose
            v-else
            :size="20"
          />
        </ActionButton>
      </div>
      <div v-show="!collapsed" class="map-tile-sidebar-content">
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
        <MapAreasPanel v-else-if="tab === 'areas'" :editor="editor" />
        <MapPropertiesPanel v-else-if="tab === 'settings'" :editor="editor" />
        <MapZonesPanel
          v-else-if="tab === 'zones'"
          :editor="editor"
          @tool="emit('tool', $event)"
        />
        <MapLightingPanel
          v-else
          :editor="editor"
          @place-light="(kind, event) => emit('place-light', kind, event)"
        />
      </div>
    </div>
  </aside>
</template>
<script setup>
import { ref } from "vue";
import { ActionButton } from "@sylvieshare/share-ui";
import {
  PanelLeftOpen,
  PanelLeftClose,
  Layers,
  Box,
  Group,
  Lightbulb,
  Square,
  Settings,
} from "@lucide/vue";
import MapPropertiesPanel from "./MapPropertiesPanel.vue";
import MapZonesPanel from "./MapZonesPanel.vue";
import MapLightingPanel from "./MapLightingPanel.vue";
import MapAreasPanel from "./MapAreasPanel.vue";
import MapObjectPalette from "./MapObjectPalette.vue";
import MapTilePalette from "./MapTilePalette.vue";
const props = defineProps({ editor: Object });
const emit = defineEmits([
  "tool",
  "model",
  "drag-tile",
  "collection",
  "object",
  "drag-object",
  "tab",
  "place-light",
]);
const tab = ref(
  props.editor.draft.document.kind === "tiles" ? "tiles" : "settings",
);
const labels = {
  tiles: "Плитки",
  objects: "Объекты",
  areas: "Области",
  lights: "Освещение",
  settings: "Настройки",
  zones: "Зоны",
};
const collapsed = ref(window.matchMedia("(max-width: 760px)").matches);
function openTab(value) {
  tab.value = value;
  collapsed.value = false;
  emit("tab", value);
}
</script>
<style scoped>
.map-tile-sidebar {
  width: 334px;
  flex: none;
  min-height: 0;
  display: flex;
  flex-direction: row;
  border-right: 1px solid var(--border-strong);
  background: var(--surface);
}
.map-sidebar-tabs {
  width: 48px;
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 6px;
  border-right: 1px solid var(--border-strong);
}
.map-sidebar-panel {
  width: 286px;
  flex: none;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.map-tile-sidebar--collapsed {
  width: 48px;
}
.map-tile-sidebar-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px;
}
.map-tile-sidebar-heading strong {
  padding-left: 6px;
}
.map-tile-sidebar-content {
  min-height: 0;
  overflow: auto;
  padding: 8px 12px 18px;
}
@media (max-width: 760px) {
  .map-tile-sidebar {
    width: min(334px, calc(100vw - 100px));
  }
  .map-sidebar-panel {
    width: calc(100% - 48px);
  }
  .map-tile-sidebar--collapsed {
    width: 48px;
  }
}
</style>
