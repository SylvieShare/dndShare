<template>
  <section class="map-areas-panel" aria-label="Области карты">
    <AddButton
      label="Создать область"
      :disabled="editor.draft.document.areas.length >= 200"
      @click="create"
    />
    <MapEntityRow
      v-for="area in editor.draft.document.areas"
      :key="area.id"
      :entry="{
        kind: 'area',
        id: area.id,
        name: area.name,
        color: area.color || DEFAULT_AREA_COLOR,
        count: area.tileIds.length + area.objectIds.length,
      }"
      :selected="editor.focusedArea === area.id"
      @select="emit('focus', area.id)"
    >
      <template #actions
        ><EyeOff v-if="area.hidden" :size="16" aria-label="Область скрыта"
      /></template>
    </MapEntityRow>
    <p v-if="!editor.draft.document.areas.length" class="map-hint">
      Областей пока нет.
    </p>
  </section>
</template>
<script setup>
import { AddButton } from "@sylvieshare/share-ui";
import { EyeOff } from "@lucide/vue";
import { DEFAULT_AREA_COLOR } from "../lib/mapAreas";
import MapEntityRow from "./MapEntityRow.vue";
const props = defineProps({ editor: Object });
const emit = defineEmits(["focus"]);
function create() {
  const id = props.editor.addArea(!props.editor.focusedArea);
  emit("focus", id);
}
</script>
<style scoped>
.map-areas-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
