<template>
  <div
    v-if="points.length"
    class="map-tile-connections"
    role="group"
    aria-label="Стыки стен"
    :class="{ 'map-tile-connections--invalid': invalid }"
  >
    <svg class="map-connection-plane" aria-hidden="true">
      <polygon :points="points.map((p) => `${p.x},${p.y}`).join(' ')" />
    </svg>
    <ActionButton
      v-for="(point, index) in points"
      :key="index"
      variant="quiet"
      icon-only
      :aria-label="`Стык: ${CONNECTIONS[index].label}`"
      :aria-pressed="!!(mask & (1 << index))"
      :title="CONNECTIONS[index].label"
      :style="{ left: `${point.x}px`, top: `${point.y}px` }"
      @pointerdown.stop
      @click="emit('toggle', index)"
    >
      <Circle
        :size="14"
        :fill="mask & (1 << index) ? 'currentColor' : 'none'"
        :class="{ 'map-connection-active': !!(mask & (1 << index)) }"
      />
    </ActionButton>
    <span
      v-if="invalid"
      class="map-connection-status"
      role="status"
      :style="{
        left: `${points[4].x}px`,
        top: `${Math.max(...points.map((p) => p.y)) + 26}px`,
      }"
      >Нет подходящей модели</span
    >
  </div>
</template>
<script setup>
import { ActionButton } from "@sylvieshare/share-ui";
import { Circle } from "@lucide/vue";
import { CONNECTIONS } from "../lib/tileConnections";
defineProps({
  points: { type: Array, default: () => [] },
  mask: Number,
  invalid: Boolean,
});
const emit = defineEmits(["toggle"]);
</script>
<style scoped>
.map-tile-connections {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.map-connection-plane {
  position: absolute;
  width: 100%;
  height: 100%;
  overflow: visible;
}
.map-connection-plane polygon {
  fill: none;
  stroke: var(--accent);
  stroke-opacity: 0.25;
}
.map-tile-connections > .share-action-button {
  position: absolute;
  transform: translate(-50%, -50%);
  pointer-events: auto;
}
.map-tile-connections svg {
  color: var(--text-muted);
}
.map-tile-connections .map-connection-active {
  color: var(--accent);
}
.map-tile-connections--invalid svg {
  color: var(--danger);
}
.map-tile-connections--invalid .map-connection-active {
  color: var(--danger);
}
.map-tile-connections--invalid polygon {
  stroke: var(--danger);
}
.map-connection-status {
  position: absolute;
  transform: translateX(-50%);
  white-space: nowrap;
  color: var(--danger);
  font-size: 11px;
}
</style>
