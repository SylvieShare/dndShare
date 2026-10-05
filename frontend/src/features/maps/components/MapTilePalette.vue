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
      <ActionButton
        v-if="mode === 'place'"
        :variant="editor.tool === 'wall-brush' ? 'primary' : 'secondary'"
        :aria-pressed="editor.tool === 'wall-brush'"
        @click="toggleWalls"
        ><Paintbrush :size="16" />Кисть стенами</ActionButton
      >
      <FormSelect v-model:value="type" aria-label="Тип плитки">
        <option
          v-for="option in types"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </FormSelect>
      <FormSelect v-model:value="wall" aria-label="Расположение стен">
        <option
          v-for="option in walls"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </FormSelect>
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
import { computed, ref } from "vue";
import { Paintbrush } from "@lucide/vue";
import { latestModelVersions } from "../lib/modelVersions";
import {
  ActionButton,
  DetailSection,
  FormSelect,
  LoadingState,
} from "@sylvieshare/share-ui";
import MapTileCard from "./MapTileCard.vue";
import { TILE_TYPES, groupedTileModels } from "../lib/modelMetadata";
const props = defineProps({
  editor: { type: Object, required: true },
  compact: Boolean,
  grouped: Boolean,
  draggable: Boolean,
  selectedId: String,
  mode: { type: String, default: "place" },
});
const emit = defineEmits(["model", "drag-tile", "tool"]);
function toggleWalls() {
  emit("tool", props.editor.tool === "wall-brush" ? "select" : "wall-brush");
}
const type = ref("all"),
  wall = ref("all");
const walls = [
  { value: "all", label: "Любое расположение стен" },
  { value: "none", label: "Без стен" },
  { value: "straight", label: "Прямая стена" },
  { value: "angle", label: "Угол" },
  { value: "tee", label: "Т-образная" },
  { value: "cross", label: "Х-образная" },
  { value: "corner", label: "Угловой выступ" },
];
const types = [{ value: "all", label: "Все" }, ...TILE_TYPES];
const filtered = computed(() =>
  latestModelVersions(props.editor.catalogue).filter(
    (m) =>
      m.collection === props.editor.collection &&
      (type.value === "all" || m.tileType === type.value) &&
      (wall.value === "all" || m.wallLayout === wall.value),
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
