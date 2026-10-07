<template>
  <div class="map-selection-actions">
    <ActionMenu v-if="!builtin" title="Добавить в область">
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
      v-if="!builtin"
      icon="trash"
      label="Удалить выбранное"
      @click="editor.removeSelected"
    />
  </div>
</template>
<script setup>
import { computed } from "vue";
import {
  ActionButton,
  ActionMenu,
  ActionMenuItem,
  RemoveButton,
} from "@sylvieshare/share-ui";
import { FolderPlus, Plus } from "@lucide/vue";
const props = defineProps({ editor: Object });
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
.map-selection-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
</style>
