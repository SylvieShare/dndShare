<template>
  <h3 class="map-tile-category-title" aria-live="polite">
    {{ categories.find((c) => c.value === modelValue)?.label }}
  </h3>
  <div class="map-tile-category-picker" role="toolbar" :aria-label="label">
    <ActionButton
      v-for="category in categories"
      :key="category.value"
      icon-only
      :variant="modelValue === category.value ? 'primary' : 'secondary'"
      :aria-label="category.label"
      :title="category.label"
      :aria-pressed="modelValue === category.value"
      @click="emit('update:modelValue', category.value)"
    >
      <template #icon><TileCategoryIcon :kind="category.value" /></template>
    </ActionButton>
  </div>
</template>
<script setup>
import { ActionButton } from "@sylvieshare/share-ui";
import { TILE_CATEGORIES } from "../lib/tileCategories";
import TileCategoryIcon from "./TileCategoryIcon.vue";
defineProps({
  modelValue: { type: String, default: "floor" },
  label: { type: String, default: "Типы тайлов" },
  categories: { type: Array, default: () => TILE_CATEGORIES },
});
const emit = defineEmits(["update:modelValue"]);
</script>
<style scoped>
.map-tile-category-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 700;
  line-height: 1.3;
}
.map-tile-category-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>
