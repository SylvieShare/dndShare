<template>
  <MapInspectorSection title="Отрисовка">
    <ToggleSwitch v-model="forceLod" label="Всегда использовать LOD-модели" />
  </MapInspectorSection>
  <MapModelMemory :usage="editor.modelMemory" />
  <MapPerformance :editor="editor" />
</template>
<script setup>
import { ToggleSwitch } from "@sylvieshare/share-ui";
import { useMapRenderSettings } from "../composables/useMapRenderSettings";
import MapInspectorSection from "./MapInspectorSection.vue";
import MapModelMemory from "./MapModelMemory.vue";
import MapPerformance from "./MapPerformance.vue";
defineProps({ editor: { type: Object, required: true } });
const { forceLod } = useMapRenderSettings();
</script>
