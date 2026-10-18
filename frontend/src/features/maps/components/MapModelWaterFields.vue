<template>
  <DetailSection label="Анимация воды" collapsible>
    <ToggleSwitch v-model="water.enabled" label="Анимировать воду" />
    <FormField
      v-for="field in fields"
      :key="field.key"
      :label="field.label"
      vertical
    >
      <AppSlider
        v-model="water[field.key]"
        :min="0"
        :max="field.max"
        :step="0.05"
        :label="field.label"
      />
    </FormField>
  </DetailSection>
</template>
<script setup>
import {
  AppSlider,
  DetailSection,
  FormField,
  ToggleSwitch,
} from "@sylvieshare/share-ui";
defineProps({ water: { type: Object, required: true } });
const fields = [
  { key: "speed", label: "Скорость течения", max: 3 },
  { key: "strength", label: "Сила волн", max: 2 },
];
</script>
