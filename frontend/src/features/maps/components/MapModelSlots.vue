<template>
  <DetailSection
    :label="`Опорные пазы (${model.supportSlots.length})`"
    collapsible
  >
    <p class="map-hint">
      Координаты пазов задаются внутри площади тайла. Высота — от нижней точки
      модели.
    </p>
    <div
      v-for="(slot, index) in model.supportSlots"
      :key="index"
      class="map-model-slot"
    >
      <strong>Паз {{ index + 1 }}</strong>
      <FormField
        v-for="field in fields"
        :key="field.key"
        :label="field.label"
        vertical
      >
        <FormTextInput
          type="number"
          :value="slot[field.key]"
          :aria-label="`Паз ${index + 1}: ${field.label}`"
          :min="field.min"
          :step="field.key === 'elevation' ? 'any' : 1"
          required
          @update:value="slot[field.key] = Number($event)"
        />
      </FormField>
      <RemoveButton
        icon="trash"
        :label="`Удалить паз ${index + 1}`"
        @click="model.supportSlots.splice(index, 1)"
      />
    </div>
    <ActionButton
      variant="secondary"
      :disabled="model.supportSlots.length >= 64"
      @click="
        model.supportSlots.push({
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          elevation: model.maxHeight,
        })
      "
      ><Plus :size="16" />Добавить паз</ActionButton
    >
  </DetailSection>
</template>
<script setup>
import {
  ActionButton,
  DetailSection,
  FormField,
  FormTextInput,
  RemoveButton,
} from "@sylvieshare/share-ui";
import { Plus } from "@lucide/vue";
defineProps({ model: Object });
const fields = [
  { key: "x", label: "X", min: 0 },
  { key: "y", label: "Y", min: 0 },
  { key: "width", label: "Ширина", min: 1 },
  { key: "height", label: "Длина", min: 1 },
  { key: "elevation", label: "Высота", min: 0 },
];
</script>
<style scoped>
.map-model-slot {
  display: grid;
  grid-template-columns: repeat(5, minmax(64px, 1fr)) auto;
  gap: 8px;
  align-items: end;
  margin: 12px 0;
}
.map-model-slot strong {
  grid-column: 1/-1;
  font-size: 12px;
}
@media (max-width: 760px) {
  .map-model-slot {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
