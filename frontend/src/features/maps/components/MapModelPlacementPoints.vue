<template>
  <DetailSection
    :label="`Места размещения (${model.placementPoints.length})`"
    collapsible
  >
    <p class="map-hint">
      Общие точки для предметов и персонажей. X/Z — внутри площади тайла, высота
      — от нижней точки модели.
    </p>
    <BaseTile
      v-for="(point, index) in model.placementPoints"
      :key="index"
      class="model-placement-point"
      :framed="selectedPoint === index"
      :tint="selectedPoint === index"
      @focusin="emit('select', index)"
      @click="emit('select', index)"
    >
      <strong>Место {{ index + 1 }}</strong>
      <FormField
        v-for="field in fields"
        :key="field.key"
        :label="field.label"
        vertical
      >
        <FormTextInput
          type="number"
          :value="point[field.key]"
          :aria-label="`Место ${index + 1}: ${field.label}`"
          min="0"
          step="any"
          required
          @update:value="point[field.key] = Number($event)"
        />
      </FormField>
      <RemoveButton
        icon="trash"
        :label="`Удалить место ${index + 1}`"
        @click.stop="model.placementPoints.splice(index, 1)"
      />
    </BaseTile>
    <ActionButton
      variant="secondary"
      :disabled="model.placementPoints.length >= 256"
      @click="add"
      ><Plus :size="16" />Добавить место</ActionButton
    >
  </DetailSection>
</template>
<script setup>
import {
  ActionButton,
  BaseTile,
  DetailSection,
  FormField,
  FormTextInput,
  RemoveButton,
} from "@sylvieshare/share-ui";
import { Plus } from "@lucide/vue";
const props = defineProps({ model: Object, selectedPoint: Number });
const emit = defineEmits(["select"]);
const fields = [
  { key: "x", label: "X" },
  { key: "y", label: "Z" },
  { key: "elevation", label: "Высота" },
];
function add() {
  props.model.placementPoints.push({
    x: props.model.width / 2,
    y: props.model.height / 2,
    elevation: props.model.surfaceHeight,
  });
  emit("select", props.model.placementPoints.length - 1);
}
</script>
<style scoped>
.model-placement-point {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: end;
  gap: 8px;
  padding: 12px;
  margin: 12px 0;
}
.model-placement-point strong {
  grid-column: 1/-1;
  font-size: 12px;
}
</style>
