<template>
  <div class="cover-summary-layout" :style="layoutStyle">
    <div class="cover-summary-side cover-summary-left"><slot name="left" /></div>
    <div class="cover-summary-safe-zone" aria-hidden="true"></div>
    <div class="cover-summary-side cover-summary-right"><slot name="right" /></div>
    <div v-if="$slots.bottom" class="cover-summary-bottom"><slot name="bottom" /></div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  sideMin: { type: Number, default: 140 },
  sideMax: { type: Number, default: 210 },
  centerMin: { type: Number, default: 180 },
  safeMinHeight: { type: Number, default: 205 },
  mediumSideMin: { type: Number, default: 125 },
  mediumSideMax: { type: Number, default: 170 },
  mediumCenterMin: { type: Number, default: 70 },
})

const layoutStyle = computed(() => ({
  '--cover-summary-side-min': `${props.sideMin}px`,
  '--cover-summary-side-max': `${props.sideMax}px`,
  '--cover-summary-center-min': `${props.centerMin}px`,
  '--cover-summary-safe-min-height': `${props.safeMinHeight}px`,
  '--cover-summary-medium-side-min': `${props.mediumSideMin}px`,
  '--cover-summary-medium-side-max': `${props.mediumSideMax}px`,
  '--cover-summary-medium-center-min': `${props.mediumCenterMin}px`,
}))
</script>

<style scoped>
.cover-summary-layout {
  flex: 1;
  width: 100%;
  display: grid;
  grid-template-columns:
    minmax(var(--cover-summary-side-min), var(--cover-summary-side-max))
    minmax(var(--cover-summary-center-min), 1fr)
    minmax(var(--cover-summary-side-min), var(--cover-summary-side-max));
  grid-template-rows: minmax(var(--cover-summary-safe-min-height), 1fr) auto;
  grid-template-areas:
    "left center right"
    "bottom bottom bottom";
  align-items: start;
  gap: 12px 18px;
}

.cover-summary-side {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.cover-summary-left { grid-area: left; }
.cover-summary-right { grid-area: right; }
.cover-summary-safe-zone {
  grid-area: center;
  min-height: var(--cover-summary-safe-min-height);
  pointer-events: none;
}
.cover-summary-bottom { grid-area: bottom; min-width: 0; }

@media (max-width: 900px) {
  .cover-summary-layout {
    grid-template-columns:
      minmax(var(--cover-summary-medium-side-min), var(--cover-summary-medium-side-max))
      minmax(var(--cover-summary-medium-center-min), 1fr)
      minmax(var(--cover-summary-medium-side-min), var(--cover-summary-medium-side-max));
    gap: 9px;
  }
}

@media (max-width: 520px) {
  .cover-summary-layout {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-rows: auto auto;
    grid-template-areas:
      "left right"
      "bottom bottom";
  }

  .cover-summary-safe-zone { display: none; }
}
</style>
