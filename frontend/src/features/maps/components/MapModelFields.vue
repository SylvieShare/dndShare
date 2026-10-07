<template>
  <div class="model-core-fields">
    <FormField label="Код группы" vertical
      ><FormTextInput
        v-model:value="model.code"
        aria-label="Код группы"
        :maxlength="160"
        required
    /></FormField>
    <FormField label="Название тайла" vertical
      ><FormTextInput
        v-model:value="model.name"
        aria-label="Название тайла"
        :maxlength="160"
        required
    /></FormField>
    <FormField label="Проработка текстур" vertical
      ><FormSelect
        v-model:value="model.textureDetail"
        aria-label="Проработка текстур"
        ><option
          v-for="level in TEXTURE_DETAILS"
          :key="level.value"
          :value="level.value"
        >
          {{ level.label }}
        </option></FormSelect
      ></FormField
    >
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
  <div v-if="model.tileType !== 'object'" class="model-classification">
    <FormField label="Тип тайла" vertical
      ><MapTileCategoryPicker v-model="model.tileType" label="Тип тайла"
    /></FormField>
    <FormField label="Расположение стен" vertical
      ><MapWallModePicker :model="model"
    /></FormField>
  </div>
  <div class="model-availability">
    <ToggleSwitch
      v-model="model.hasDecor"
      label="Есть предметы или декорации"
    />
    <ToggleSwitch v-model="model.canStand" label="Можно встать" />
  </div>
</template>
<script setup>
import {
  FormField,
  FormSelect,
  FormTextInput,
  ToggleSwitch,
} from "@sylvieshare/share-ui";
import { TEXTURE_DETAILS } from "../lib/modelMetadata";
import MapTileCategoryPicker from "./MapTileCategoryPicker.vue";
import MapWallModePicker from "./MapWallModePicker.vue";
defineProps({ model: Object });
</script>
<style scoped>
.model-availability {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  margin: 12px 0;
}
.model-core-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
.model-classification {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 18px;
  margin: 18px 0;
}
@media (max-width: 1000px) {
  .model-core-fields {
    grid-template-columns: minmax(0, 1fr);
  }
  .model-classification {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
