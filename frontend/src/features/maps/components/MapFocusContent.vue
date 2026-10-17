<template>
  <div class="map-focus-content">
    <div class="map-focus-heading"><slot name="heading" /></div>
    <div class="map-focus-body"><slot /></div>
  </div>
</template>
<style scoped>
.map-focus-content {
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.map-focus-heading {
  flex: none;
  padding: var(--map-panel-inset, 14px) var(--map-panel-inset, 14px) 0;
  margin-bottom: 12px;
}
.map-focus-body {
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 25px;
  padding: 0 var(--map-panel-inset, 14px) var(--map-panel-inset, 14px);
}
.map-focus-body > :deep(*) {
  flex-shrink: 0;
}
</style>
