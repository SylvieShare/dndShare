<template>
  <section class="map-object-palette" aria-label="Каталог объектов">
    <p v-if="mode === 'inspect'" class="map-hint">
      Выберите объект для просмотра параметров.
    </p>
    <p v-else class="map-hint">
      {{
        draggable
          ? "Перетащите объект на подсвеченную точку."
          : "Выберите объект и поставьте его на подсвеченную точку."
      }}
      R — поворот, Esc — отмена.
    </p>
    <div class="map-object-grid">
      <MapTileCard
        v-for="model in models"
        :key="model.id"
        :model="model"
        :selected="selectedId === model.id"
        :draggable="draggable"
        @model="(id, event) => emit('object', id, event)"
        @drag-tile="(id, event) => emit('drag-object', id, event)"
      />
    </div>
    <p v-if="!models.length" class="map-hint">Объекты ещё загружаются.</p>
  </section>
</template>
<script setup>
import { computed } from "vue";
import MapTileCard from "./MapTileCard.vue";
import { latestModelVersions } from "../lib/modelVersions";
const props = defineProps({
  editor: Object,
  draggable: Boolean,
  selectedId: String,
  mode: { type: String, default: "place" },
});
const emit = defineEmits(["object", "drag-object"]);
const models = computed(() =>
  latestModelVersions(props.editor.catalogue).filter(
    (m) => m.tileType === "object",
  ),
);
</script>
<style scoped>
.map-object-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
}
</style>
