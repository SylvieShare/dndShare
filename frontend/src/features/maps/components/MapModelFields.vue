<template>
  <div class="model-core-fields">
    <FormField label="Код группы" vertical
      ><FormTextInput
        v-model:value="model.code"
        aria-label="Код группы"
        :maxlength="160"
        required
    /></FormField>
    <FormField label="Код вариантов" vertical
      ><FormTextInput
        v-model:value="model.variantCode"
        aria-label="Код вариантов"
        :maxlength="160"
        placeholder="Пусто — отдельный тайл"
    /></FormField>
    <FormField label="Название (русский)" vertical
      ><FormTextInput
        v-model:value="model.name"
        aria-label="Название (русский)"
        :maxlength="160"
        required
    /></FormField>
    <FormField label="Название (английский)" vertical
      ><FormTextInput
        v-model:value="model.nameEn"
        aria-label="Название (английский)"
        :maxlength="160"
        required
    /></FormField>
    <FormField label="Группа (русский)" vertical
      ><FormTextInput
        v-model:value="model.groupName"
        aria-label="Группа (русский)"
        :maxlength="160"
        required
    /></FormField>
    <FormField label="Группа (английский)" vertical
      ><FormTextInput
        v-model:value="model.groupNameEn"
        aria-label="Группа (английский)"
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
  <FormField
    v-if="model.tileType !== 'object'"
    label="Категория"
    vertical
    class="model-category-field"
    ><MapTileCategoryPicker v-model="model.category" label="Категория"
  /></FormField>
  <div v-if="model.tileType !== 'object'" class="model-classification">
    <FormField label="Форма тайла" vertical
      ><MapTileCategoryPicker
        v-model="model.tileType"
        :categories="TILE_TYPES"
        label="Форма тайла"
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
import { TEXTURE_DETAILS, TILE_TYPES } from "../lib/modelMetadata";
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
.model-category-field {
  margin-top: 18px;
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
