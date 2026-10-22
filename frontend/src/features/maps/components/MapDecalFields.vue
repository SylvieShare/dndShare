<template>
  <MapInspectorSection title="Изображение">
    <FormField label="Название" vertical
      ><FormTextInput
        :value="decal.name"
        maxlength="100"
        @change="update('name', $event)"
    /></FormField>
    <FormField label="Категория" vertical>
      <FormSelect :value="decal.category" @change="update('category', $event)">
        <option
          v-for="item in DECAL_CATEGORIES"
          :key="item.id"
          :value="item.id"
        >
          {{ item.name }}
        </option>
      </FormSelect>
    </FormField>
    <FormField
      v-for="field in fields"
      :key="field.key"
      :label="field.label"
      vertical
    >
      <AppSlider
        :model-value="decal[field.key]"
        :label="field.label"
        :min="field.min"
        :max="field.max"
        :step="field.step"
        @update:model-value="editor.updateDecal(field.key, $event)"
        @change="editor.finishDecalEdit"
      />
    </FormField>
    <FormField label="Оттенок" vertical
      ><FormTextInput
        type="color"
        :value="decal.color"
        @change="update('color', $event)"
    /></FormField>
    <ActionButton variant="secondary" @click="editor.moveDecal(decal)"
      >Переместить на поверхность</ActionButton
    >
  </MapInspectorSection>
  <MapInspectorSection v-if="owner" title="Поверхность">
    <MapEntityRow :entry="owner" @select="emit('focus', [owner])" />
  </MapInspectorSection>
</template>
<script setup>
import { computed } from "vue";
import {
  ActionButton,
  AppSlider,
  FormField,
  FormSelect,
  FormTextInput,
} from "@sylvieshare/share-ui";
import { DECAL_CATEGORIES } from "../lib/mapDecals";
import { mapEntity } from "../lib/editorEntities";
import MapInspectorSection from "./MapInspectorSection.vue";
import MapEntityRow from "./MapEntityRow.vue";
const props = defineProps({ editor: Object, decal: Object });
const emit = defineEmits(["focus"]);
const owner = computed(() =>
  mapEntity(
    props.editor.draft.document,
    props.editor.catalogue,
    props.decal.anchor.kind,
    props.decal.anchor.id,
  ),
);
const fields = [
  { key: "width", label: "Ширина", min: 0.05, max: 8, step: 0.05 },
  { key: "height", label: "Высота", min: 0.05, max: 8, step: 0.05 },
  { key: "rotation", label: "Поворот", min: 0, max: 360, step: 1 },
  { key: "opacity", label: "Непрозрачность", min: 0, max: 1, step: 0.01 },
  { key: "depth", label: "Глубина наложения", min: 0.01, max: 2, step: 0.01 },
];
function update(key, value) {
  props.editor.updateDecal(key, value);
  props.editor.finishDecalEdit();
}
</script>
