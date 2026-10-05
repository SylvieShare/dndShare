<template>
  <section class="map-items-library" aria-label="Предметы для карты">
    <p class="map-hint">
      Выберите предмет, затем переместите курсор на карту и нажмите для
      размещения. R — поворот, Esc — отмена.
    </p>
    <h2>Объекты</h2>
    <div class="map-items-grid">
      <BaseTile
        v-for="object in OBJECTS"
        :key="object.id"
        interactive
        role="button"
        tabindex="0"
        :aria-label="object.name"
        @click="emit('object', object.id, $event)"
        @keydown.enter.prevent="emit('object', object.id, $event)"
        ><Box :size="28" /><span>{{ object.name }}</span></BaseTile
      >
    </div>
    <h2>Модели коллекции</h2>
    <div class="map-items-grid">
      <BaseTile
        v-for="model in models"
        :key="model.id"
        interactive
        role="button"
        tabindex="0"
        :aria-label="model.name"
        @click="emit('model', model.id, $event)"
        @keydown.enter.prevent="emit('model', model.id, $event)"
        ><img :src="model.previewUrl" alt="" width="140" height="140" /><span>{{
          model.name
        }}</span
        ><small>{{ model.sourceCode }}</small></BaseTile
      >
    </div>
  </section>
</template>
<script setup>
import { computed } from "vue";
import { BaseTile } from "@sylvieshare/share-ui";
import { Box } from "@lucide/vue";
import { OBJECTS } from "../lib/mapModel";
import { latestModelVersions } from "../lib/modelVersions";
const props = defineProps({ editor: Object }),
  emit = defineEmits(["model", "object"]);
const models = computed(() =>
  latestModelVersions(props.editor.catalogue).filter(
    (m) =>
      m.collection === props.editor.collection &&
      ["prop", "stairs"].includes(m.tileType),
  ),
);
</script>
<style scoped>
.map-items-library {
  padding: 24px;
  overflow: auto;
  min-height: 0;
  flex: 1;
}
.map-items-library h2 {
  font-size: 16px;
  margin: 20px 0 12px;
}
.map-items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}
.map-items-grid > * {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 14px;
  cursor: pointer;
}
.map-items-grid img {
  object-fit: contain;
  max-width: 100%;
}
</style>
