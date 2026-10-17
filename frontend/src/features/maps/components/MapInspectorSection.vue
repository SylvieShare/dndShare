<template>
  <section class="map-inspector-section" :aria-label="title">
    <MapPanelHeading :title="title" />
    <div class="map-inspector-section-body"><slot /></div>
  </section>
</template>
<script setup>
import MapPanelHeading from "./MapPanelHeading.vue";
defineProps({ title: String });
</script>
<style scoped>
.map-inspector-section-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
