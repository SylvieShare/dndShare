<template>
  <aside
    class="map-tile-sidebar"
    :class="{ 'map-tile-sidebar--collapsed': collapsed }"
    aria-label="Каталог плиток"
    @contextmenu.prevent
  >
    <div class="map-tile-sidebar-heading">
      <strong v-if="!collapsed">Плитки</strong>
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
        :editor="editor"
        compact
        grouped
        draggable
        @model="(id, event) => emit('model', id, event)"
        @drag-tile="(id, event) => emit('drag-tile', id, event)"
        @tool="emit('tool', $event)"
      />
    </div>
  </aside>
</template>
<script setup>
import { ref } from "vue";
import { ActionButton } from "@sylvieshare/share-ui";
import { PanelLeftOpen, PanelLeftClose } from "@lucide/vue";
import MapTilePalette from "./MapTilePalette.vue";
defineProps({ editor: Object });
const emit = defineEmits(["model", "drag-tile", "tool"]);
const collapsed = ref(window.matchMedia("(max-width: 760px)").matches);
</script>
<style scoped>
.map-tile-sidebar {
  width: 286px;
  flex: none;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-strong);
  background: var(--surface);
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
    width: min(286px, calc(100vw - 100px));
  }
  .map-tile-sidebar--collapsed {
    width: 48px;
  }
}
</style>
