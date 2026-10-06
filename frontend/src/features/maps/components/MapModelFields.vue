<template>
  <div class="map-model-fields">
    <FormField label="Название тайла" vertical
      ><FormTextInput
        v-model:value="model.name"
        aria-label="Название тайла"
        :maxlength="160"
        required
    /></FormField>
    <FormField label="Тип тайла" vertical
      ><FormSelect v-model:value="model.tileType" aria-label="Тип тайла"
        ><option v-for="t in TILE_TYPES" :key="t.value" :value="t.value">
          {{ t.label }}
        </option></FormSelect
      ></FormField
    >
    <FormField label="Проработка текстур" vertical>
      <FormSelect
        v-model:value="model.textureDetail"
        aria-label="Проработка текстур"
      >
        <option
          v-for="level in TEXTURE_DETAILS"
          :key="level.value"
          :value="level.value"
        >
          {{ level.label }}
        </option>
      </FormSelect>
    </FormField>
    <FormField label="Расположение стен" vertical
      ><FormSelect
        :value="model.wallMode"
        aria-label="Расположение стен тайла"
        @change="setMode"
        ><option v-for="m in WALL_MODES" :key="m.value" :value="m.value">
          {{ m.label }}
        </option></FormSelect
      ></FormField
    >
    <FormField v-for="f in dimensions" :key="f.key" :label="f.label" vertical
      ><FormTextInput
        type="number"
        :value="model[f.key]"
        :aria-label="f.label"
        :min="f.min"
        :max="f.max"
        :step="f.integer ? 1 : 'any'"
        required
        @update:value="model[f.key] = Number($event)"
    /></FormField>
    <FormField
      v-for="(axis, index) in ['X', 'Z']"
      :key="axis"
      :label="`Смещение модели ${axis}`"
      vertical
      ><FormTextInput
        type="number"
        :value="model.placementOffset[index]"
        :aria-label="`Смещение модели ${axis}`"
        min="-8"
        max="8"
        step="any"
        required
        @update:value="model.placementOffset[index] = Number($event)"
    /></FormField>
    <FormField label="Метки через запятую" vertical
      ><FormTextInput
        :value="model.tags.join(', ')"
        aria-label="Метки тайла"
        @update:value="
          model.tags = $event
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        "
    /></FormField>
  </div>
  <p class="map-hint">
    Расположение стен задаёт геометрию стыков: по центру клетки или по её краям.
    Размеры и высоты — в единицах сетки. Высоты измеряются от нижней точки
    модели; монтажное основание находится ниже поверхности размещения.
  </p>
  <DetailSection
    v-if="model.wallMode !== 'none'"
    :label="`Стыки стен · маска ${model.wallMask}`"
  >
    <div class="map-model-ports">
      <ToggleSwitch
        v-for="(p, index) in CONNECTIONS"
        v-show="model.wallMode !== 'edge' || index % 2 === 0"
        :key="p.key"
        :label="p.label"
        :model-value="!!(model.wallMask & (1 << index))"
        @update:model-value="model.wallMask ^= 1 << index"
      />
    </div>
  </DetailSection>
</template>
<script setup>
import {
  DetailSection,
  FormField,
  FormSelect,
  FormTextInput,
  ToggleSwitch,
} from "@sylvieshare/share-ui";
import { TILE_TYPES, WALL_MODES, TEXTURE_DETAILS } from "../lib/modelMetadata";
import { CONNECTIONS } from "../lib/tileConnections";
const props = defineProps({ model: Object });
const dimensions = [
  { key: "wallMask", label: "Маска стыков", min: 0, max: 255, integer: true },
  {
    key: "width",
    label: "Ширина тайла в клетках",
    min: 1,
    max: 8,
    integer: true,
  },
  {
    key: "height",
    label: "Длина тайла в клетках",
    min: 1,
    max: 8,
    integer: true,
  },
  { key: "mountDepth", label: "Глубина монтажного основания", min: 0, max: 32 },
  { key: "surfaceHeight", label: "Высота поверхности", min: 0, max: 32 },
  { key: "maxHeight", label: "Полная высота модели", min: 0, max: 32 },
];
function setMode(value) {
  props.model.wallMode = value;
  if (value === "edge") props.model.wallMask &= 85;
  if (value === "none") props.model.wallMask = 0;
}
</script>
<style scoped>
.map-model-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
.map-model-ports {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
@media (max-width: 760px) {
  .map-model-fields {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
