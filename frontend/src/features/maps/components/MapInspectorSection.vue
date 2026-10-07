<template>
  <section class="map-inspector-section" :aria-label="title">
    <SectionLabel :title="title" border role="heading" aria-level="4" />
    <div class="map-inspector-section-body"><slot /></div>
  </section>
</template>
<script setup>
import { SectionLabel } from "@sylvieshare/share-ui";
defineProps({ title: String });
</script>
<style scoped>
.map-inspector-section-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
