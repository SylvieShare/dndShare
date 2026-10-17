<template>
  <MapLightingControls
    :enabled="editor.draft.document.lightingEnabled"
    :sun="editor.draft.document.sun"
    @update:enabled="editor.updateLightingMode"
    @update:sun="editor.updateSun"
    @finish="editor.finishLightEdit"
  >
    <template #summary>
      <div class="map-shadow-count" role="status">
        Локальных источников с тенями: {{ shadowCount }}
      </div>
      <p
        v-if="editor.draft.document.lightingEnabled && shadowCount > 2"
        class="map-shadow-warning"
        role="note"
      >
        Много источников с тенями могут замедлить карту.
      </p>
      <p v-if="enabledCount > 8" class="map-shadow-warning" role="note">
        Одновременно отображаются до 8 локальных источников.
      </p>
    </template>
    <MapLightPresetMenu
      :disabled="manualLightCount(editor.draft.document) >= 32"
      @place-light="(kind, event) => emit('place-light', kind, event)"
    />
    <MapEntityRow
      v-for="light in lights"
      :key="light.id"
      :entry="light"
      toggle-light
      :selected="editor.selectedLight === light.id"
      @select="editor.selectLight(light.id)"
      @focus="editor.focusLight(light.id)"
      @toggle="editor.toggleLight"
    />
  </MapLightingControls>
</template>
<script setup>
import { computed } from "vue";
import { mapEntity } from "../lib/editorEntities";
import { manualLightCount } from "../lib/builtinLights";
import MapLightingControls from "./MapLightingControls.vue";
import MapLightPresetMenu from "./MapLightPresetMenu.vue";
import MapEntityRow from "./MapEntityRow.vue";
const props = defineProps({ editor: Object });
const emit = defineEmits(["place-light"]);
const shadowCount = computed(
  () =>
    props.editor.draft.document.lights.filter((l) => l.enabled && l.shadows)
      .length,
);
const enabledCount = computed(
  () => props.editor.draft.document.lights.filter((l) => l.enabled).length,
);
const lights = computed(() =>
  props.editor.draft.document.lights.map((light) =>
    mapEntity(
      props.editor.draft.document,
      props.editor.catalogue,
      "light",
      light.id,
    ),
  ),
);
</script>

<style scoped>
.map-shadow-count {
  font-size: 12px;
  color: var(--text-muted);
}
.map-shadow-warning {
  margin: 0;
  padding: 8px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--warning) 10%, transparent);
  color: var(--warning);
  font-size: 12px;
}
</style>
