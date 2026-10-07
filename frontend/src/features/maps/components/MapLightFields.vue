<template>
  <div class="map-light-fields">
    <FormField label="Название" vertical
      ><FormTextInput
        :value="light.name"
        aria-label="Название источника света"
        :maxlength="100"
        @change="
          editor.updateLight(light.id, 'name', $event.trim() || light.name)
        "
    /></FormField>
    <ToggleSwitch
      :model-value="light.enabled"
      :disabled="!light.enabled && light.shadows && shadowCount >= 2"
      label="Источник включён"
      @update:model-value="editor.updateLight(light.id, 'enabled', $event)"
    />
    <FormField label="Показывать сферу"
      ><CompactCheckbox
        :model-value="light.showMarker"
        label="Показывать сферу источника"
        @update:model-value="
          editor.updateLight(light.id, 'showMarker', $event)
        "
    /></FormField>
    <FormField label="Цвет" vertical
      ><ColorPresetPicker
        :model-value="light.color"
        :colors="colours"
        allow-custom
        aria-label="Цвет источника света"
        custom-label="Свой цвет света"
        @update:model-value="editor.updateLight(light.id, 'color', $event)"
    /></FormField>
    <FormField
      v-for="field in fields"
      :key="field.key"
      :label="`${field.label}: ${light[field.key]}`"
      vertical
    >
      <AppSlider
        :model-value="light[field.key]"
        :min="field.min"
        :max="field.max"
        :step="field.step"
        :label="field.label"
        @update:model-value="editor.updateLight(light.id, field.key, $event)"
        @change="editor.finishLightEdit"
      />
    </FormField>
    <ToggleSwitch
      :model-value="light.flicker"
      label="Мерцание"
      @update:model-value="editor.updateLight(light.id, 'flicker', $event)"
    />
    <ToggleSwitch
      :model-value="light.shadows"
      :disabled="!light.shadows && shadowCount >= 2"
      label="Создавать тени"
      @update:model-value="editor.updateLight(light.id, 'shadows', $event)"
    />
    <p class="map-hint">
      Тени доступны у двух локальных источников одновременно.
    </p>
    <FormField label="Область" vertical
      ><FormSelect
        :value="light.areaId || ''"
        aria-label="Область источника света"
        @change="editor.updateLight(light.id, 'areaId', $event)"
        ><option value="">По привязке</option>
        <option
          v-for="area in editor.draft.document.areas"
          :key="area.id"
          :value="area.id"
        >
          {{ area.name }}
        </option></FormSelect
      ></FormField
    >
    <ActionButton
      variant="secondary"
      @click="
        editor.bindingLight === light.id
          ? editor.cancelLightBinding()
          : emit('bind', light.id)
      "
    >
      {{ editor.bindingLight === light.id ? "Отменить привязку" : "Привязать" }}
    </ActionButton>
    <p v-if="editor.bindingLight === light.id" class="map-hint" role="status">
      Нажмите на плитку или объект на карте.
    </p>
    <template v-if="anchor">
      <p class="map-hint">
        Привязан к {{ light.anchor.kind === "tile" ? "тайлу" : "объекту" }}.
      </p>
      <MapEntityRow :entry="anchor" @select="emit('focus', $event)" />
    </template>
    <ActionButton
      v-if="light.anchor"
      variant="quiet"
      @click="editor.bindLight(light.id, null)"
      >Отвязать источник</ActionButton
    >
  </div>
</template>
<script setup>
import { computed } from "vue";
import {
  ActionButton,
  CompactCheckbox,
  AppSlider,
  ColorPresetPicker,
  FormField,
  FormSelect,
  FormTextInput,
  ToggleSwitch,
} from "@sylvieshare/share-ui";
import { mapEntity } from "../lib/editorEntities";
import MapEntityRow from "./MapEntityRow.vue";
const emit = defineEmits(["bind", "focus"]);
const props = defineProps({ editor: Object, light: Object });
const colours = [
  "#ffc36a",
  "#ffd899",
  "#ff8c63",
  "#a98aff",
  "#68cfff",
  "#75e6ac",
  "#ffffff",
  "#ff6f9f",
];
const fields = [
  { key: "intensity", label: "Яркость", min: 0, max: 50, step: 0.5 },
  { key: "radius", label: "Радиус света", min: 0.25, max: 32, step: 0.25 },
  { key: "height", label: "Высота источника", min: 0, max: 16, step: 0.1 },
];
const shadowCount = computed(
  () =>
    props.editor.draft.document.lights.filter(
      (l) => l.enabled && l.shadows && l.id !== props.light.id,
    ).length,
);
const anchor = computed(
  () =>
    props.light.anchor &&
    mapEntity(
      props.editor.draft.document,
      props.editor.catalogue,
      props.light.anchor.kind,
      props.light.anchor.id,
    ),
);
</script>
<style scoped>
.map-light-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0;
}
</style>
