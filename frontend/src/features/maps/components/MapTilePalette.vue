<template>
  <section
    class="map-tile-palette"
    :class="{ 'map-tile-palette--compact': compact }"
  >
    <LoadingState v-if="editor.loadingModels" label="Загружаем плитки…" />
    <div v-else-if="editor.modelError" class="map-error" role="alert">
      {{ editor.modelError }}
      <ActionButton variant="secondary" @click="editor.retryModels"
        >Повторить</ActionButton
      >
    </div>
    <template v-else>
      <MapCollectionPicker
        :catalogue="editor.catalogue"
        :model-value="editor.collection"
        @update:model-value="emit('collection', $event)"
      />
      <MapTileCategoryPicker
        v-if="categories.length"
        v-model="category"
        :categories="categories"
        large
      />
      <MultiToggle
        v-if="contentOptions.length === 2"
        v-model="content"
        :options="contentOptions"
        aria-label="Наполнение плиток"
      />
      <p class="map-hint">
        {{
          mode === "inspect"
            ? "Выберите тайл для просмотра параметров."
            : draggable
              ? "Перетащите плитку на карту. R — поворот."
              : "Выберите плитку, затем нажмите на карте."
        }}
      </p>
      <div class="map-model-grid">
        <MapModelGroupCard
          v-for="group in groups"
          :key="group.key"
          :group="group"
          :selected-id="selectedId || editor.selectedModel"
          :draggable="draggable"
          @model="(id, event) => emit('model', id, event)"
          @drag-tile="(id, event) => emit('drag-tile', id, event)"
        />
      </div>
      <p v-if="!filtered.length" class="map-hint">
        В выбранном паке пока нет плиток.
      </p>
    </template>
  </section>
</template>
<script setup>
import { computed, ref, watch } from "vue";
import { visibleModels } from "../lib/visibleModels";
import { ActionButton, LoadingState, MultiToggle } from "@sylvieshare/share-ui";
import MapCollectionPicker from "./MapCollectionPicker.vue";
import MapModelGroupCard from "./MapModelGroupCard.vue";
import { modelGroups } from "../lib/modelGroups";
const props = defineProps({
  editor: { type: Object, required: true },
  compact: Boolean,
  draggable: Boolean,
  selectedId: String,
  mode: { type: String, default: "place" },
});
import MapTileCategoryPicker from "./MapTileCategoryPicker.vue";
import { TILE_CATEGORIES, matchesTileCategory } from "../lib/tileCategories";
const emit = defineEmits(["model", "drag-tile", "collection"]);
const category = ref("floor");
const preferredContent = ref("free");
const CONTENT_OPTIONS = [
  { value: "free", label: "Свободные" },
  { value: "furnished", label: "С предметами" },
];
const models = computed(() =>
  visibleModels(props.editor.catalogue).filter(
    (m) => m.collection === props.editor.collection && m.tileType !== "object",
  ),
);
const categories = computed(() =>
  TILE_CATEGORIES.filter((c) =>
    models.value.some((m) => matchesTileCategory(m, c.value)),
  ),
);
const categoryModels = computed(() =>
  models.value.filter((m) => matchesTileCategory(m, category.value)),
);
const contentOptions = computed(() =>
  CONTENT_OPTIONS.filter((option) =>
    categoryModels.value.some(
      (m) => !!m.hasDecor === (option.value === "furnished"),
    ),
  ),
);
// Keep the last explicit choice while categories with only one variant show
// that available variant automatically.
const content = computed({
  get: () =>
    contentOptions.value.find((o) => o.value === preferredContent.value)
      ?.value || contentOptions.value[0]?.value,
  set: (value) => {
    preferredContent.value = value;
  },
});
function initialCategory() {
  const selected = models.value.find((m) => m.id === props.selectedId);
  if (selected) {
    category.value = selected.tileType;
    preferredContent.value = selected.hasDecor ? "furnished" : "free";
    return;
  }
  category.value = categories.value[0]?.value || "";
}
watch(() => props.editor.collection, initialCategory);
watch(
  categories,
  (available) => {
    if (!available.some((c) => c.value === category.value)) initialCategory();
  },
  { immediate: true },
);
watch(
  () => props.editor.loadingModels,
  (loading) => {
    if (!loading) initialCategory();
  },
  { immediate: true },
);
watch(
  () => props.selectedId,
  (id) => {
    const selected = models.value.find((m) => m.id === id);
    if (selected)
      preferredContent.value = selected.hasDecor ? "furnished" : "free";
    if (selected && !matchesTileCategory(selected, category.value))
      category.value = selected.tileType;
  },
  { immediate: true },
);
const filtered = computed(() =>
  categoryModels.value.filter(
    (m) => !!m.hasDecor === (content.value === "furnished"),
  ),
);
const groups = computed(() => modelGroups(filtered.value));
</script>
<style scoped>
.map-tile-palette {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.map-model-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 8px;
}
.map-tile-palette--compact .map-model-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
</style>
