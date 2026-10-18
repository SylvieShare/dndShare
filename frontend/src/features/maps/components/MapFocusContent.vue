<template>
  <InspectorContent class="map-focus-content">
    <template #heading><slot name="heading" /></template>
    <slot />
  </InspectorContent>
</template>
<script setup>
import InspectorContent from '@/shared/ui/InspectorContent.vue'
</script>
<style scoped>
.map-focus-content { --inspector-inset: var(--map-panel-inset, 14px); }
</style>
