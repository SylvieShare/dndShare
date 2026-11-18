<template>
  <BaseTile :outlined="false" class="wizard-section-panel">
    <TileAccentStrip color="color-mix(in srgb, var(--accent) 55%, transparent)" />
    <slot />
  </BaseTile>
</template>

<script setup>
import { BaseTile, TileAccentStrip } from '@sylvieshare/share-ui'
</script>

<style scoped>
.wizard-section-panel {
  display: grid;
  gap: var(--spacing-medium);
  min-width: 0;
  padding: var(--spacing-medium);
}
</style>
