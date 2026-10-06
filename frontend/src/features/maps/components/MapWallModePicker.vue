<template>
  <div
    class="model-wall-modes"
    role="toolbar"
    aria-label="Расположение стен тайла"
  >
    <ActionButton
      v-for="mode in WALL_MODES"
      :key="mode.value"
      icon-only
      :variant="model.wallMode === mode.value ? 'primary' : 'secondary'"
      :aria-label="mode.label"
      :title="mode.label"
      :aria-pressed="model.wallMode === mode.value"
      @click="choose(mode.value)"
    >
      <template #icon
        ><img
          :src="icons[mode.value]"
          width="44"
          height="44"
          alt=""
          draggable="false"
      /></template>
    </ActionButton>
  </div>
  <p class="map-hint">
    {{ WALL_MODES.find((m) => m.value === model.wallMode)?.label }}
  </p>
</template>
<script setup>
import { ActionButton } from "@sylvieshare/share-ui";
import { WALL_MODES } from "../lib/modelMetadata";
import none from "@/assets/maps/wall-modes/none.webp";
import center from "@/assets/maps/wall-modes/center.webp";
import edge from "@/assets/maps/wall-modes/edge.webp";
const props = defineProps({ model: Object });
const icons = { none, center, edge };
function choose(value) {
  props.model.wallMode = value;
  if (value === "edge") props.model.wallMask &= 85;
  if (value === "none") props.model.wallMask = 0;
}
</script>
<style scoped>
.model-wall-modes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.model-wall-modes img {
  object-fit: contain;
}
</style>
