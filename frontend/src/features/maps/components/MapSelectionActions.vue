<template>
  <MapInspectorSection v-if="boundLight || !builtin || area" title="Область">
    <BaseTile
      v-if="area"
      class="map-selection-area"
      framed
      interactive
      role="button"
      tabindex="0"
      :aria-label="`Перейти к области «${area.name}»`"
      :color="area.color"
      @click="!hasSelectedText() && emit('area', area.id)"
      @keydown.enter.self.prevent="emit('area', area.id)"
      @keydown.space.self.prevent="emit('area', area.id)"
    >
      <Group
        :size="20"
        :style="{ color: area.color }"
        aria-hidden="true"
      /><strong>{{ area.name }}</strong
      ><ArrowUpRight :size="18" aria-hidden="true" />
    </BaseTile>
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
  BaseTile,
  ActionMenu,
  ActionMenuItem,
  RemoveButton,
  FormSelect,
} from "@sylvieshare/share-ui";
import { hasSelectedText } from "../lib/textSelection";
import { lightArea } from "../lib/mapLighting";
import MapInspectorSection from "./MapInspectorSection.vue";
import { ArrowUpRight, Group, Plus } from "@lucide/vue";
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
.map-selection-area {
  display: flex;
  align-items: center;
  padding: 10px;
  cursor: pointer;
  gap: 8px;
}
.map-selection-area strong {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 13px;
}
.map-selection-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
</style>
