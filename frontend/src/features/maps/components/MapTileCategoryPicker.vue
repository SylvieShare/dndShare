<template>
  <h3 class="map-tile-category-title" aria-live="polite">
    {{ categories.find((c) => c.value === modelValue)?.label }}
  </h3>
  <div
    class="map-tile-category-picker"
    :class="{ 'map-tile-category-picker--large': large }"
    role="toolbar"
    :aria-label="label"
  >
    <BaseTile
      v-for="category in categories"
      :key="category.value"
      interactive
      role="button"
      tabindex="0"
      class="map-category-tile"
      :framed="modelValue === category.value"
      :tint="modelValue === category.value"
      :aria-label="category.label"
      :title="category.label"
      :aria-pressed="modelValue === category.value"
      @click="emit('update:modelValue', category.value)"
      @keydown.enter.prevent="emit('update:modelValue', category.value)"
      @keydown.space.prevent="emit('update:modelValue', category.value)"
    >
      <TileCategoryIcon :kind="category.value" :size="large ? 64 : 36" />
    </BaseTile>
  </div>
</template>
<script setup>
import { BaseTile } from "@sylvieshare/share-ui";
import { TILE_CATEGORIES } from "../lib/tileCategories";
import TileCategoryIcon from "./TileCategoryIcon.vue";
defineProps({
  large: Boolean,
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
.map-category-tile {
  flex: none;
  width: 48px;
  height: 48px;
  min-width: 0;
  display: grid;
  place-items: center;
}
.map-tile-category-picker--large .map-category-tile {
  flex: 1 1 calc(33.333% - 4px);
  width: auto;
  height: 80px;
}
.map-category-tile:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
