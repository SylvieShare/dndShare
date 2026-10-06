<template>
  <DetailSection label="Солнце">
    <ToggleSwitch
      :model-value="sun.enabled"
      label="Солнечный свет"
      :disabled="!editor.draft.document.lightingEnabled"
      @update:model-value="editor.updateSun('enabled', $event)"
    />
    <FormField :label="`Направление: ${Math.round(sun.angle)}°`" vertical
      ><AppSlider
        :model-value="sun.angle"
        :min="0"
        :max="360"
        :step="1"
        :disabled="!editor.draft.document.lightingEnabled || !sun.enabled"
        label="Направление солнца"
        @update:model-value="editor.updateSun('angle', $event)"
        @change="editor.finishLightEdit"
    /></FormField>
    <FormField
      :label="`Высота над горизонтом: ${Math.round(sun.elevation)}°`"
      vertical
      ><AppSlider
        :model-value="sun.elevation"
        :min="10"
        :max="85"
        :step="1"
        :disabled="!editor.draft.document.lightingEnabled || !sun.enabled"
        label="Высота солнца"
        @update:model-value="editor.updateSun('elevation', $event)"
        @change="editor.finishLightEdit"
    /></FormField>
  </DetailSection>
</template>
<script setup>
import { computed } from "vue";
import {
  AppSlider,
  DetailSection,
  FormField,
  ToggleSwitch,
} from "@sylvieshare/share-ui";
import { DEFAULT_SUN } from "../lib/mapLighting";
const props = defineProps({ editor: Object });
const sun = computed(() => props.editor.draft.document.sun || DEFAULT_SUN);
</script>
