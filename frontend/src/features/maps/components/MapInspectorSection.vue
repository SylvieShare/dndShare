<template>
  <section class="map-inspector-section" :aria-label="title">
    <MapPanelHeading :title="title">
      <template v-if="$slots.actions" #actions><slot name="actions" /></template>
    </MapPanelHeading>
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
