<template>
  <div
    v-if="points.length"
    class="map-tile-connections"
    role="group"
    :aria-label="mode === 'edge' ? 'Стороны стен' : 'Стыки стен'"
    :class="{ 'map-tile-connections--invalid': invalid }"
  >
    <svg class="map-connection-plane" aria-hidden="false">
      <polygon
        :points="
          [7, 1, 3, 5].map((i) => `${points[i].x},${points[i].y}`).join(' ')
        "
        aria-hidden="true"
      />
      <template v-if="mode === 'edge'">
        <line
          v-for="(index, side) in [0, 2, 4, 6]"
          :key="index"
          :x1="points[[7, 1, 3, 5][side]].x"
          :y1="points[[7, 1, 3, 5][side]].y"
          :x2="points[[1, 3, 5, 7][side]].x"
          :y2="points[[1, 3, 5, 7][side]].y"
          class="map-connection-side"
          :class="{ 'map-connection-active': !!(mask & (1 << index)) }"
          tabindex="0"
          role="button"
          :aria-label="`Сторона: ${CONNECTIONS[index].label}`"
          :aria-pressed="!!(mask & (1 << index))"
          @pointerdown.stop
          @click="emit('toggle', index)"
          @keydown.enter.prevent="emit('toggle', index)"
          @keydown.space.prevent="emit('toggle', index)"
        >
          <title>{{ CONNECTIONS[index].label }}</title>
        </line>
      </template>
      <template v-else>
        <circle
          v-for="(point, index) in points"
          :key="index"
          :cx="point.x"
          :cy="point.y"
          r="6"
          class="map-connection-point"
          :class="{ 'map-connection-active': !!(mask & (1 << index)) }"
          tabindex="0"
          role="button"
          :aria-label="`Стык: ${CONNECTIONS[index].label}`"
          :aria-pressed="!!(mask & (1 << index))"
          @pointerdown.stop
          @click="emit('toggle', index)"
          @keydown.enter.prevent="emit('toggle', index)"
          @keydown.space.prevent="emit('toggle', index)"
        >
          <title>{{ CONNECTIONS[index].label }}</title>
        </circle>
      </template>
    </svg>
    <span
      v-if="invalid"
      class="map-connection-status"
      role="status"
      :style="{
        left: `${points[4].x}px`,
        top: `${Math.max(...points.map((p) => p.y)) + 15}px`,
      }"
      >Нет подходящей модели</span
    >
  </div>
</template>
<script setup>
import { CONNECTIONS } from "../lib/tileConnections";
defineProps({
  points: { type: Array, default: () => [] },
  mask: Number,
  invalid: Boolean,
  mode: { type: String, default: "center" },
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
  filter: drop-shadow(0 1px 2px var(--bg));
}
.map-connection-plane polygon {
  fill: color-mix(in srgb, var(--accent) 18%, transparent);
  stroke: var(--text-1);
  stroke-width: 2;
}
.map-connection-point {
  fill: var(--bg);
  stroke: var(--text-1);
  stroke-width: 2;
  pointer-events: auto;
  cursor: pointer;
}
.map-connection-point.map-connection-active {
  fill: var(--accent-soft);
  stroke: var(--text-on-accent);
}
.map-connection-side {
  stroke: var(--text-1);
  stroke-width: 6;
  stroke-linecap: round;
  pointer-events: stroke;
  cursor: pointer;
}
.map-connection-side.map-connection-active {
  stroke: var(--accent-soft);
  stroke-width: 8;
}
.map-connection-point:hover,
.map-connection-point:focus {
  stroke: var(--accent-soft);
  stroke-width: 3;
}
.map-tile-connections--invalid polygon,
.map-tile-connections--invalid .map-connection-point,
.map-tile-connections--invalid .map-connection-side {
  stroke: var(--danger);
}
.map-tile-connections--invalid .map-connection-active {
  fill: var(--danger);
}
.map-connection-status {
  position: absolute;
  transform: translateX(-50%);
  white-space: nowrap;
  color: var(--danger);
  font-size: 11px;
}
</style>
