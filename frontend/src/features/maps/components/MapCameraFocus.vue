<template>
  <MapSelectedEntity :entry="entry" :editor="editor" :copyable="false">
    <template #preview
      ><MapCameraPreview :editor="editor" :camera="camera"
    /></template>
    <MapInspectorSection v-if="editor.broadcastCamera" title="Трансляция">
      <ActionButton
        variant="secondary"
        @click="editor.broadcastCamera(camera.id)"
        ><template #icon><MonitorUp :size="18" /></template>Транслировать вид
        камеры</ActionButton
      >
    </MapInspectorSection>
    <MapInspectorSection title="Положение камеры">
      <FormField
        :label="`Высота (Z): ${camera.view.position[2].toFixed(1)}`"
        vertical
      >
        <AppSlider
          :model-value="camera.view.position[2]"
          :min="Math.min(0, camera.view.position[2])"
          :max="Math.max(32, camera.view.position[2])"
          :step="0.1"
          label="Высота камеры"
          @update:model-value="editor.editCamera('height', $event)"
          @change="editor.finishCameraEdit"
        />
      </FormField>
    </MapInspectorSection>
    <MapInspectorSection title="Кадр">
      <FormField
        :label="`Ширина, клеток: ${camera.view.width.toFixed(1)}`"
        vertical
      >
        <AppSlider
          :model-value="camera.view.width"
          :min="0.5"
          :max="Math.max(300, camera.view.width)"
          :step="0.1"
          label="Ширина кадра"
          @update:model-value="editor.editCamera('width', $event)"
          @change="editor.finishCameraEdit"
        />
      </FormField>
    </MapInspectorSection>
  </MapSelectedEntity>
</template>
<script setup>
import { computed } from "vue";
import { MonitorUp } from "@lucide/vue";
import { ActionButton, AppSlider, FormField } from "@sylvieshare/share-ui";
import MapSelectedEntity from "./MapSelectedEntity.vue";
import MapInspectorSection from "./MapInspectorSection.vue";
import MapCameraPreview from "./MapCameraPreview.vue";
const props = defineProps({ editor: Object, camera: Object });
const entry = computed(() => ({
  kind: "camera",
  id: props.camera.id,
  name: props.camera.name,
  item: props.camera,
}));
</script>
