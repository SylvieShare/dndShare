<template>
  <div class="model-geometry-fields">
    <FormField
      v-for="field in GEOMETRY_FIELDS"
      :key="field.key"
      :label="field.label"
      vertical
    >
      <span
        class="model-field-dot"
        :style="{ background: field.color }"
        aria-hidden="true"
      />
      <FormTextInput
        type="number"
        :value="geometryValue(model, field.key)"
        :aria-label="field.label"
        :min="
          field.key.startsWith('offset')
            ? -8
            : field.key === 'maxHeight'
              ? model.surfaceHeight
              : 0
        "
        :max="
          field.key.startsWith('offset')
            ? 8
            : field.key === 'mountDepth'
              ? model.surfaceHeight
              : 32
        "
        step="any"
        required
        @update:value="setGeometryValue(model, field.key, $event)"
        @focus="emit('active', field.key)"
      />
    </FormField>
  </div>
</template>
<script setup>
import { FormField, FormTextInput } from "@sylvieshare/share-ui";
import {
  GEOMETRY_FIELDS,
  geometryValue,
  setGeometryValue,
} from "../lib/modelPreviewGeometry";
defineProps({ model: Object });
const emit = defineEmits(["active"]);
</script>
<style scoped>
.model-geometry-fields {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
}
.model-geometry-fields > * {
  position: relative;
}
.model-field-dot {
  position: absolute;
  top: 1px;
  right: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
@media (max-width: 1000px) {
  .model-geometry-fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
