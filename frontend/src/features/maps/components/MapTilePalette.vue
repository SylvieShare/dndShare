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
      <FilterHeading
        v-if="categories.length"
        :title="categories.find((c) => c.value === category)?.label"
        label="Фильтры плиток"
        :active-count="Number(content !== 'all') + Number(lighting !== 'all')"
      >
        <FormField label="Наполнение" vertical
          ><ValueSelect
            v-model="content"
            :options="CONTENT_OPTIONS"
            aria-label="Наполнение плиток"
        /></FormField>
        <FormField label="Освещение" vertical
          ><ValueSelect
            v-model="lighting"
            :options="LIGHT_OPTIONS"
            aria-label="Освещение плиток"
        /></FormField>
      </FilterHeading>
      <MapTileCategoryPicker
        v-if="categories.length"
        v-model="category"
        :categories="categories"
        large
        :show-title="false"
      />
      <p class="map-hint">
        {{
          mode === "inspect"
            ? "Выберите тайл для просмотра параметров."
            : mode === "select"
              ? "Выберите целевой тайл для перехода."
              : draggable
                ? "Перетащите плитку на карту. R — поворот."
                : "Выберите плитку, затем нажмите на карте."
        }}
      </p>
      <MapModelCatalogue
        :models="filtered"
        :wall-subcategories="category === 'wall'"
        :compact="compact"
        :selected-id="selectedId || editor.selectedModel"
        :draggable="draggable"
        :show-identifiers="mode === 'inspect'"
        @model="(id, event) => emit('model', id, event)"
        @drag-tile="(id, event) => emit('drag-tile', id, event)"
      />
      <p v-if="!filtered.length" class="map-hint">
        Нет плиток с выбранными параметрами.
      </p>
    </template>
  </section>
</template>
<script setup>
import { computed, ref, watch } from "vue";
import {
  ActionButton,
  LoadingState,
  FormField,
  ValueSelect,
} from "@sylvieshare/share-ui";
import FilterHeading from "@/shared/ui/FilterHeading.vue";
import { visibleModels } from "../lib/visibleModels";
import { hasModelLight } from "../lib/modelGroups";
import { TILE_CATEGORIES, matchesTileCategory } from "../lib/tileCategories";
import MapCollectionPicker from "./MapCollectionPicker.vue";
import MapModelCatalogue from "./MapModelCatalogue.vue";
import MapTileCategoryPicker from "./MapTileCategoryPicker.vue";
const props = defineProps({
  editor: { type: Object, required: true },
  compact: Boolean,
  draggable: Boolean,
  selectedId: String,
  mode: { type: String, default: "place" },
});
const emit = defineEmits(["model", "drag-tile", "collection"]);
const category = ref("floor"),
  content = ref("all"),
  lighting = ref("all");
const CONTENT_OPTIONS = [
  { value: "all", label: "Любое наполнение" },
  { value: "free", label: "Свободные" },
  { value: "furnished", label: "С предметами" },
];
const LIGHT_OPTIONS = [
  { value: "all", label: "Любое освещение" },
  { value: "with", label: "Есть освещение" },
  { value: "without", label: "Без освещения" },
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
function initialCategory() {
  const selected = models.value.find((m) => m.id === props.selectedId);
  category.value = selected?.category || categories.value[0]?.value || "";
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
  () => props.selectedId,
  (id) => {
    const selected = models.value.find((m) => m.id === id);
    if (selected) {
      category.value = selected.category;
      // A target chosen elsewhere must remain visible without classifying it anew.
      if (
        content.value !== "all" &&
        selected.hasDecor !== (content.value === "furnished")
      )
        content.value = "all";
      if (
        lighting.value !== "all" &&
        hasModelLight(selected) !== (lighting.value === "with")
      )
        lighting.value = "all";
    }
  },
  { immediate: true },
);
const filtered = computed(() =>
  models.value.filter(
    (m) =>
      matchesTileCategory(m, category.value) &&
      (content.value === "all" ||
        !!m.hasDecor === (content.value === "furnished")) &&
      (lighting.value === "all" ||
        hasModelLight(m) === (lighting.value === "with")),
  ),
);
</script>
<style scoped>
.map-tile-palette {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
