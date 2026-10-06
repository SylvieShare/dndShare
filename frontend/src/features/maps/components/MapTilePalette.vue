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
      <MapTileCategoryPicker v-model="category" />
      <ToggleSwitch v-model="decorOnly" label="Есть декор" />
      <p class="map-hint">
        {{
          mode === "inspect"
            ? "Выберите тайл для просмотра параметров."
            : draggable
              ? "Перетащите плитку на карту. R — поворот."
              : "Выберите плитку, затем нажмите на карте."
        }}
      </p>
      <template v-if="grouped">
        <DetailSection
          v-for="group in groups"
          :key="group.value"
          :label="`${group.label} (${group.models.length})`"
          collapsible
        >
          <div class="map-model-grid">
            <MapTileCard
              v-for="model in group.models"
              :key="model.id"
              :model="model"
              :selected="(selectedId || editor.selectedModel) === model.id"
              :draggable="draggable"
              @model="(id, event) => emit('model', id, event)"
              @drag-tile="(id, event) => emit('drag-tile', id, event)"
            />
          </div>
        </DetailSection>
      </template>
      <div v-else class="map-model-grid">
        <MapTileCard
          v-for="model in filtered"
          :key="model.id"
          :model="model"
          :selected="(selectedId || editor.selectedModel) === model.id"
          :draggable="draggable"
          @model="(id, event) => emit('model', id, event)"
          @drag-tile="(id, event) => emit('drag-tile', id, event)"
        />
      </div>
      <p v-if="!filtered.length" class="map-hint">
        Плиток с такими фильтрами нет.
      </p>
    </template>
  </section>
</template>
<script setup>
import { computed, ref, watch } from "vue";
import { latestModelVersions } from "../lib/modelVersions";
import {
  ActionButton,
  DetailSection,
  LoadingState,
  ToggleSwitch,
} from "@sylvieshare/share-ui";
import MapCollectionPicker from "./MapCollectionPicker.vue";
import MapTileCard from "./MapTileCard.vue";
import { groupedTileModels } from "../lib/modelMetadata";
const props = defineProps({
  editor: { type: Object, required: true },
  compact: Boolean,
  grouped: Boolean,
  draggable: Boolean,
  selectedId: String,
  mode: { type: String, default: "place" },
});
import MapTileCategoryPicker from "./MapTileCategoryPicker.vue";
import { TILE_CATEGORIES, matchesTileCategory } from "../lib/tileCategories";
const emit = defineEmits(["model", "drag-tile", "collection"]);
const category = ref("floor");
const decorOnly = ref(false);
const models = computed(() =>
  latestModelVersions(props.editor.catalogue).filter(
    (m) => m.collection === props.editor.collection && m.tileType !== "object",
  ),
);
function initialCategory() {
  const selected = models.value.find((m) => m.id === props.selectedId);
  if (selected) {
    category.value = selected.tileType;
    return;
  }
  const first = TILE_CATEGORIES.find((c) =>
    models.value.some((m) => matchesTileCategory(m, c.value)),
  );
  category.value = first?.value || "floor";
}
watch(() => props.editor.collection, initialCategory);
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
    if (selected && !matchesTileCategory(selected, category.value))
      category.value = selected.tileType;
  },
  { immediate: true },
);
const filtered = computed(() =>
  models.value.filter(
    (m) =>
      matchesTileCategory(m, category.value) &&
      (!decorOnly.value || m.hasDecor),
  ),
);
const groups = computed(() => groupedTileModels(filtered.value));
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
