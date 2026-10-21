<template>
  <MapInspectorSection v-if="boundLight || !builtin || area" title="Область">
    <InspectorReference v-if="area" class="map-selection-area" :name="area.name" :color="area.color" :icon="Group" :label="`Перейти к области «${area.name}»`" @activate="emit('area', area.id)" />
    <p v-else-if="boundLight" class="map-hint">Без области</p>
    <FormSelect
      v-if="unboundLight && area"
      :value="entry.item.areaId || ''"
      aria-label="Область источника света"
      @change="editor.updateLight(entry.id, 'areaId', $event)"
    >
      <option value="">Без области</option>
      <option
        v-for="candidate in editor.draft.document.areas"
        :key="candidate.id"
        :value="candidate.id"
      >
        {{ candidate.name }}
      </option>
    </FormSelect>
    <div class="map-selection-actions">
      <ActionMenu
        v-if="!boundLight && !builtin && !area"
        title="Добавить в область"
      >
        <template #trigger
          ><ActionButton variant="secondary"
            ><template #icon><Group :size="20" /></template>Добавить в
            область</ActionButton
          ></template
        >
        <template #default="{ close }">
          <ActionMenuItem
            v-for="area in editor.draft.document.areas"
            :key="area.id"
            :icon="Group"
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
  FormSelect,
} from "@sylvieshare/share-ui";
import InspectorReference from "@/shared/ui/InspectorReference.vue";
import { lightArea } from "../lib/mapLighting";
import MapInspectorSection from "./MapInspectorSection.vue";
import { Group, Plus } from "@lucide/vue";
const props = defineProps({ editor: Object, entry: Object });
const boundLight = computed(
  () => props.entry?.kind === "light" && !!props.entry.item.anchor,
);
const unboundLight = computed(
  () => props.entry?.kind === "light" && !props.entry.item.anchor,
);
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
.map-selection-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
</style>
