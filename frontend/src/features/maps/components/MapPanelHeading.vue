<template>
  <div class="map-panel-heading">
    <SectionLabel
      :title="title"
      :space-after="12"
      size="medium"
      role="heading"
      :aria-level="level"
    >
      <template v-if="$slots.actions || count != null" #actions>
        <slot name="actions">{{ count }}</slot>
      </template>
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
