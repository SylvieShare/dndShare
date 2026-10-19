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
    <MapModelCatalogue
      :models="models"
      :selected-id="selectedId || editor.objectModel"
      :draggable="draggable"
      :show-identifiers="mode === 'inspect'"
      @model="(id, event) => emit('object', id, event)"
      @drag-tile="(id, event) => emit('drag-object', id, event)"
    />
    <p v-if="!models.length" class="map-hint">Объекты ещё загружаются.</p>
  </section>
</template>
<script setup>
import { computed } from "vue";
import MapModelCatalogue from "./MapModelCatalogue.vue";
import { visibleModels } from "../lib/visibleModels";
const props = defineProps({
  editor: Object,
  draggable: Boolean,
  selectedId: String,
  mode: { type: String, default: "place" },
});
const emit = defineEmits(["object", "drag-object"]);
const models = computed(() =>
  visibleModels(props.editor.catalogue).filter((m) => m.tileType === "object"),
);
</script>
