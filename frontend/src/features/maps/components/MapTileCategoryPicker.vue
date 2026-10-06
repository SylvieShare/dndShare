<template>
  <div class="map-tile-category-picker" role="toolbar" :aria-label="label">
    <ActionButton
      v-for="category in TILE_CATEGORIES"
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
  <p class="map-hint" aria-live="polite">
    {{ TILE_CATEGORIES.find((c) => c.value === modelValue)?.label }}
  </p>
</template>
<script setup>
import { ActionButton } from "@sylvieshare/share-ui";
import { TILE_CATEGORIES } from "../lib/tileCategories";
import TileCategoryIcon from "./TileCategoryIcon.vue";
defineProps({
  modelValue: { type: String, default: "floor" },
  label: { type: String, default: "Типы тайлов" },
});
const emit = defineEmits(["update:modelValue"]);
</script>
<style scoped>
.map-tile-category-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>
