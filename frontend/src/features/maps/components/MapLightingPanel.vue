<template>
  <section class="map-lighting-panel" aria-label="Освещение карты">
    <FormField label="Режим освещения"
      ><CompactCheckbox
        :model-value="editor.draft.document.lightingEnabled"
        label="Режим освещения"
        @update:model-value="editor.updateLightingMode($event)"
    /></FormField>
    <MapSunSettings :editor="editor" />
    <div class="map-lighting-heading">
      <h3>Источники света</h3>
      <MapLightPresetMenu
        :disabled="editor.draft.document.lights.length >= 32"
        @place-light="(kind, event) => emit('place-light', kind, event)"
      />
    </div>
    <MapEntityRow
      v-for="light in lights"
      :key="light.id"
      :entry="light"
      toggle-light
      :selected="editor.selectedLight === light.id"
      @select="editor.selectLight(light.id)"
      @toggle="editor.toggleLight"
    />
  </section>
</template>
<script setup>
import { computed } from "vue";
import { CompactCheckbox, FormField } from "@sylvieshare/share-ui";
import { mapEntity } from "../lib/editorEntities";
import MapLightPresetMenu from "./MapLightPresetMenu.vue";
import MapSunSettings from "./MapSunSettings.vue";
import MapEntityRow from "./MapEntityRow.vue";
const props = defineProps({ editor: Object });
const emit = defineEmits(["place-light"]);
const lights = computed(() =>
  props.editor.draft.document.lights.map((l) =>
    mapEntity(
      props.editor.draft.document,
      props.editor.catalogue,
      "light",
      l.id,
    ),
  ),
);
</script>
<style scoped>
.map-lighting-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.map-lighting-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.map-lighting-heading h3 {
  margin: 0;
  font-size: 14px;
}
</style>
