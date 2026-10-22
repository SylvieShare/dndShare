<template>
  <MapFocusContent
    ><template #heading
      ><Camera :size="20" /><InlineEdit
        :model-value="camera.name"
        label="Название камеры"
        :maxlength="100"
        required
        @confirm="editor.updateCamera((c) => (c.name = String($event).trim()))"
    /></template>
    <div class="camera-preview-row">
      <MapCameraPreview :editor="editor" :camera="camera" /><ActionButton
        icon-only
        variant="quiet"
        class="camera-delete"
        aria-label="Удалить камеру"
        @click="editor.removeCamera"
        ><template #icon><Trash2 :size="18" /></template
      ></ActionButton>
    </div>
    <MapInspectorSection title="Положение камеры"
      ><div class="camera-coordinates">
        <FormField
          v-for="(label, index) in ['X', 'Y', 'Z']"
          :key="label"
          :label="label"
          vertical
          ><FormNumberInput
            :value="camera.view.position[index]"
            :step="0.5"
            :min="-200"
            :max="200"
            :aria-label="`Камера: ${label}`"
            @change="
              editor.updateCamera((c) => (c.view.position[index] = $event))
            "
        /></FormField></div></MapInspectorSection
    ><MapInspectorSection title="Точка взгляда"
      ><ActionButton variant="secondary" @click="editor.tool = 'camera-focus'"
        ><template #icon><Crosshair :size="16" /></template>Выбрать на
        карте</ActionButton
      >
      <div class="camera-coordinates">
        <FormField
          v-for="(label, index) in ['X', 'Y', 'Z']"
          :key="label"
          :label="label"
          vertical
          ><FormNumberInput
            :value="camera.view.target[index]"
            :step="0.5"
            :min="-200"
            :max="200"
            :aria-label="`Фокус: ${label}`"
            @change="
              editor.updateCamera((c) => (c.view.target[index] = $event))
            "
        /></FormField></div></MapInspectorSection
    ><MapInspectorSection title="Кадр"
      ><FormField label="Ширина, клеток" vertical
        ><FormNumberInput
          :value="camera.view.width"
          :min="0.5"
          :max="300"
          :step="0.5"
          aria-label="Ширина кадра"
          @change="editor.updateCamera((c) => (c.view.width = $event))"
      /></FormField>
      <p class="map-hint">
        Меньше ширина — крупнее масштаб. Превью использует LOD-модели.
      </p></MapInspectorSection
    ></MapFocusContent
  >
</template>
<script setup>
import {
  ActionButton,
  FormField,
  FormNumberInput,
  InlineEdit,
} from "@sylvieshare/share-ui";
import { Camera, Crosshair, Trash2 } from "@lucide/vue";
import MapFocusContent from "./MapFocusContent.vue";
import MapInspectorSection from "./MapInspectorSection.vue";
import MapCameraPreview from "./MapCameraPreview.vue";
defineProps({ editor: Object, camera: Object });
</script>
<style scoped>
.camera-preview-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 40px;
  gap: 8px;
  align-items: start;
}
.camera-coordinates {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.camera-delete {
  color: var(--danger);
}
</style>
