<template>
  <MapInspectorSection title="Изображение и сетка"
    ><FormField v-for="f in fields" :key="f.key" :label="f.label" vertical
      ><FormNumberInput
        :value="editor.draft.document.image[f.key]"
        :min="f.min"
        :max="f.max"
        :step="0.5"
        @change="editor.change((m) => (m.document.image[f.key] = $event))"
    /></FormField>
    <p class="map-hint">
      Подгоните размер клетки под сетку исходной картинки. Смещение задаётся в
      клетках.
    </p></MapInspectorSection
  >
</template>
<script setup>
import { FormField, FormNumberInput } from "@sylvieshare/share-ui";
import MapInspectorSection from "./MapInspectorSection.vue";
defineProps({ editor: Object });
const fields = [
  {
    key: "cellPixels",
    label: "Клетка изображения, пикселей",
    min: 1,
    max: 4096,
  },
  { key: "offsetX", label: "Смещение X", min: -160, max: 160 },
  { key: "offsetY", label: "Смещение Y", min: -160, max: 160 },
];
</script>
