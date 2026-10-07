<template>
  <DetailSection label="Дневное освещение">
    <ToggleSwitch
      :model-value="sun.enabled"
      label="Дневной свет"
      :disabled="disabled || !enabled"
      @update:model-value="emit('update', 'enabled', $event)"
    />
    <FormField :label="`Направление: ${Math.round(sun.angle)}°`" vertical
      ><AppSlider
        :model-value="sun.angle"
        :min="0"
        :max="360"
        :step="1"
        :disabled="disabled || !enabled || !sun.enabled"
        label="Направление дневного света"
        @update:model-value="emit('update', 'angle', $event)"
        @change="emit('finish')"
    /></FormField>
    <FormField
      :label="`Высота над горизонтом: ${Math.round(sun.elevation)}°`"
      vertical
      ><AppSlider
        :model-value="sun.elevation"
        :min="10"
        :max="85"
        :step="1"
        :disabled="disabled || !enabled || !sun.enabled"
        label="Высота дневного света"
        @update:model-value="emit('update', 'elevation', $event)"
        @change="emit('finish')"
    /></FormField>
  </DetailSection>
</template>
<script setup>
import {
  AppSlider,
  DetailSection,
  FormField,
  ToggleSwitch,
} from "@sylvieshare/share-ui";
import { DEFAULT_SUN } from "../lib/mapLighting";
defineProps({ enabled: Boolean, disabled: Boolean, sun: { type: Object, default: () => ({ ...DEFAULT_SUN }) } });
const emit = defineEmits(['update', 'finish']);
</script>
