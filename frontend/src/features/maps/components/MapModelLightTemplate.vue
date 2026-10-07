<template>
  <BaseTile class="model-light-template">
    <FormField label="Название" vertical
      ><FormTextInput
        v-model:value="light.name"
        :aria-label="`Встроенный источник ${index + 1}: название`"
        :maxlength="100"
        required
    /></FormField>
    <FormField label="Тип" vertical
      ><FormSelect
        v-model:value="light.kind"
        :aria-label="`Встроенный источник ${index + 1}: тип`"
      >
        <option value="torch">Факел</option>
        <option value="candle">Свеча</option>
        <option value="magic">Магический свет</option>
      </FormSelect></FormField
    >
    <FormField
      v-for="(label, coordinate) in ['X', 'Y', 'Высота']"
      :key="label"
      :label="label"
      vertical
    >
      <FormTextInput
        type="number"
        :value="light.position[coordinate]"
        :aria-label="`Встроенный источник ${index + 1}: ${label}`"
        :min="coordinate === 2 ? 0 : -8"
        :max="coordinate === 2 ? 32 : 8"
        step="any"
        required
        @update:value="light.position[coordinate] = Number($event)"
      />
    </FormField>
    <FormField
      v-for="field in fields"
      :key="field.key"
      :label="field.label"
      vertical
    >
      <FormTextInput
        type="number"
        :value="light[field.key]"
        :aria-label="`Встроенный источник ${index + 1}: ${field.label}`"
        :min="field.min"
        :max="field.max"
        step="any"
        required
        @update:value="light[field.key] = Number($event)"
      />
    </FormField>
    <FormField label="Цвет" vertical
      ><ColorPresetPicker
        v-model="light.color"
        :colors="colours"
        allow-custom
        :aria-label="`Встроенный источник ${index + 1}: цвет`"
    /></FormField>
    <ToggleSwitch v-model="light.enabled" label="Включён по умолчанию" />
    <ToggleSwitch v-model="light.flicker" label="Мерцание" />
    <RemoveButton
      icon="trash"
      :label="`Удалить встроенный источник ${index + 1}`"
      @click="emit('remove')"
    />
  </BaseTile>
</template>
<script setup>
import {
  BaseTile,
  FormField,
  FormSelect,
  FormTextInput,
  ColorPresetPicker,
  ToggleSwitch,
  RemoveButton,
} from "@sylvieshare/share-ui";
defineProps({ light: Object, index: Number });
const emit = defineEmits(["remove"]);
const fields = [
  { key: "intensity", label: "Яркость", min: 0, max: 50 },
  { key: "radius", label: "Радиус", min: 0.25, max: 32 },
];
const colours = [
  "#ffc36a",
  "#ffd899",
  "#a98aff",
  "#68cfff",
  "#75e6ac",
  "#ffffff",
];
</script>
<style scoped>
.model-light-template {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  padding: 12px;
  margin-bottom: 12px;
}
@media (max-width: 760px) {
  .model-light-template {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
