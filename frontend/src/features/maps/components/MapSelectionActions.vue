<template>
  <MapInspectorSection v-if="!builtin || area" title="Область">
    <div v-if="area" class="map-selection-area">
      <span>{{ area.name }}</span>
      <ActionButton
        icon-only
        variant="quiet"
        :aria-label="`Перейти к области «${area.name}»`"
        :title="`Перейти к области «${area.name}»`"
        @click="emit('area', area.id)"
        ><template #icon><ArrowUpRight :size="18" /></template
      ></ActionButton>
    </div>
    <div class="map-selection-actions">
      <ActionMenu v-if="!builtin && !area" title="Добавить в область">
        <template #trigger
          ><ActionButton variant="secondary"
            ><FolderPlus :size="18" />Добавить в область</ActionButton
          ></template
        >
        <template #default="{ close }">
          <ActionMenuItem
            v-for="area in editor.draft.document.areas"
            :key="area.id"
            :icon="FolderPlus"
            @click="
              add(area.id);
              close();
            "
            >{{ area.name }}</ActionMenuItem
          >
          <ActionMenuItem
            :icon="Plus"
            :disabled="editor.draft.document.areas.length >= 200"
            @click="
              create();
              close();
            "
            >Создать область</ActionMenuItem
          >
        </template>
      </ActionMenu>
      <RemoveButton
        v-if="!entry && !builtin"
        icon="trash"
        label="Удалить выбранное"
        @click="editor.removeSelected"
      />
    </div>
  </MapInspectorSection>
</template>
<script setup>
import { computed } from "vue";
import {
  ActionButton,
  ActionMenu,
  ActionMenuItem,
  RemoveButton,
} from "@sylvieshare/share-ui";
import { lightArea } from "../lib/mapLighting";
import MapInspectorSection from "./MapInspectorSection.vue";
import { ArrowUpRight, FolderPlus, Plus } from "@lucide/vue";
const props = defineProps({ editor: Object, entry: Object });
const emit = defineEmits(["area"]);
const area = computed(() => {
  const { entry, editor } = props;
  if (!entry) return null;
  const d = editor.draft.document;
  return d.areas.find((a) =>
    entry.kind === "light"
      ? a.id === lightArea(entry.item, d)
      : (entry.kind === "tile" ? a.tileIds : a.objectIds).includes(entry.id),
  );
});
const builtin = computed(
  () =>
    props.editor.selectedLight &&
    props.editor.draft.document.lights.find(
      (l) => l.id === props.editor.selectedLight,
    )?.builtinKey,
);
function add(id) {
  const e = props.editor;
  if (e.selectedLight) e.updateLight(e.selectedLight, "areaId", id);
  else e.addSelectionToArea(id);
}
function create() {
  props.editor.addArea(true, props.editor.selectedLight);
}
</script>
<style scoped>
.map-selection-area {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.map-selection-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
</style>
