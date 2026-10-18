<template>
  <MapInspectorSection title="Пламя">
    <ToggleSwitch
      :model-value="effect?.kind === 'fire'"
      label="Показывать пламя"
      @update:model-value="toggle"
    />
    <Transition name="light-effect">
      <div v-if="effect?.kind === 'fire'" class="light-effect-fields">
        <FormField
          v-for="field in fields"
          :key="field.key"
          :label="field.label"
          vertical
        >
          <AppSlider
            :model-value="value(field)"
            :min="field.min"
            :max="Math.max(field.max, value(field))"
            :step="field.step"
            :label="field.label"
            @update:model-value="patch(field, $event)"
            @change="emit('finish')"
          />
        </FormField>
      </div>
    </Transition>
    <FormField v-if="effect" label="Колебания" vertical>
      <AppSlider
        :model-value="effect.strength"
        :min="0"
        :max="2"
        :step="0.05"
        label="Колебания"
        @update:model-value="patch({ key: 'strength' }, $event)"
        @change="emit('finish')"
      />
    </FormField>
  </MapInspectorSection>
</template>
<script setup>
import { AppSlider, FormField, ToggleSwitch } from "@sylvieshare/share-ui";
import MapInspectorSection from "./MapInspectorSection.vue";
import { defaultFireEffect } from "../lib/lightEffect";
const props = defineProps({ effect: Object });
const emit = defineEmits(["update", "finish"]);
const fields = [
  {
    key: "size",
    index: 0,
    label: "Ширина пламени",
    min: 0.02,
    max: 8,
    step: 0.02,
  },
  {
    key: "size",
    index: 1,
    label: "Высота пламени",
    min: 0.02,
    max: 16,
    step: 0.02,
  },
];
const value = (f) =>
  f.index === undefined ? props.effect[f.key] : props.effect[f.key][f.index];
function toggle(enabled) {
  emit("finish");
  emit("update", {
    ...(props.effect || defaultFireEffect()),
    kind: enabled ? "fire" : "none",
  });
  emit("finish");
}
function patch(field, value) {
  const effect = { ...props.effect };
  if (field.index === undefined) effect[field.key] = value;
  else {
    effect[field.key] = [...effect[field.key]];
    effect[field.key][field.index] = value;
  }
  emit("update", effect);
}
</script>
<style scoped>
.light-effect-fields {
  display: grid;
  gap: 10px;
}
.light-effect-enter-active,
.light-effect-leave-active {
  transition:
    opacity 0.18s,
    transform 0.18s;
}
.light-effect-enter-from,
.light-effect-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
@media (prefers-reduced-motion: reduce) {
  .light-effect-enter-active,
  .light-effect-leave-active {
    transition: none;
  }
}
</style>
