<template>
  <section class="map-areas-panel" aria-label="Области карты">
    <AddButton
      label="Создать область"
      :disabled="editor.draft.document.areas.length >= 200"
      @click="editor.addArea"
    />
    <p class="map-hint">
      Выделите тайлы или объект на карте и добавьте их в область. Модель может
      входить в одну область.
    </p>
    <MapAreaCard
      v-for="(area, index) in editor.draft.document.areas"
      :key="area.id"
      :area="area"
      :index="index"
      :editor="editor"
      :focus="focusArea === area.id"
    />
    <p v-if="!editor.draft.document.areas.length" class="map-hint">
      Областей пока нет.
    </p>
  </section>
</template>
<script setup>
import { AddButton } from "@sylvieshare/share-ui";
import MapAreaCard from "./MapAreaCard.vue";
defineProps({ editor: Object, focusArea: String });
</script>
<style scoped>
.map-areas-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
