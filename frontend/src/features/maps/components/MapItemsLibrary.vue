<template>
  <section class="map-items-library" aria-label="Предметы для карты">
    <MapObjectPalette
      :editor="editor"
      @object="(id, event) => emit('object', id, event)"
    />
  </section>
</template>
<script setup>
import MapObjectPalette from "./MapObjectPalette.vue";
defineProps({ editor: Object });
const emit = defineEmits(["object"]);
</script>
<style scoped>
.map-items-library {
  padding: 24px;
  overflow: auto;
  flex: 1;
  min-height: 0;
}
</style>
