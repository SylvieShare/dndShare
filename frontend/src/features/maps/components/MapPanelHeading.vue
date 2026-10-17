<template>
  <div class="map-panel-heading">
    <SectionLabel
      :title="title"
      border
      border-position="before"
      inset="var(--map-panel-inset, 14px)"
      role="heading"
      :aria-level="level"
    >
      <template v-if="count != null" #actions>{{ count }}</template>
    </SectionLabel>
  </div>
</template>
<script setup>
import { SectionLabel } from "@sylvieshare/share-ui";
defineProps({
  title: String,
  count: Number,
  level: { type: Number, default: 4 },
});
</script>
<style scoped>
.map-panel-heading {
  margin-inline: calc(-1 * var(--map-panel-inset, 14px));
}
</style>
