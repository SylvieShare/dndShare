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
        <g
          v-for="wall in walls"
          :key="wall.index"
          class="map-connection-wall"
          :class="{ 'map-connection-active': !!(mask & (1 << wall.index)) }"
          tabindex="0"
          role="button"
          :aria-label="`Сторона: ${CONNECTIONS[wall.index].label}`"
          :aria-pressed="!!(mask & (1 << wall.index))"
          @pointerdown.stop
          @click="emit('toggle', wall.index)"
          @keydown.enter.prevent="emit('toggle', wall.index)"
          @keydown.space.prevent="emit('toggle', wall.index)"
        >
          <title>{{ CONNECTIONS[wall.index].label }}</title>
          <polygon :points="wall.front" class="map-connection-wall-face" />
          <polygon :points="wall.side" class="map-connection-wall-side" />
          <polygon :points="wall.top" class="map-connection-wall-top" />
        </g>
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
import { computed } from "vue";
import { connectionWallShapes } from "../lib/connectionWalls";
import { CONNECTIONS } from "../lib/tileConnections";
const props = defineProps({
  points: { type: Array, default: () => [] },
  mask: Number,
  invalid: Boolean,
  mode: { type: String, default: "center" },
});
const walls = computed(() => connectionWallShapes(props.points));
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
.map-connection-plane > polygon {
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
.map-connection-wall {
  pointer-events: auto;
  cursor: pointer;
}
.map-connection-wall polygon {
  fill: var(--surface);
  stroke: var(--text-1);
  stroke-width: 1.5;
  pointer-events: all;
}
.map-connection-wall .map-connection-wall-top {
  fill: var(--surface-raised);
}
.map-connection-wall.map-connection-active polygon {
  fill: var(--accent-soft);
  stroke: var(--text-on-accent);
}
.map-connection-wall:hover polygon,
.map-connection-wall:focus polygon {
  stroke: var(--accent);
  stroke-width: 3;
}
.map-connection-point:hover,
.map-connection-point:focus {
  stroke: var(--accent-soft);
  stroke-width: 3;
}
.map-tile-connections--invalid polygon,
.map-tile-connections--invalid .map-connection-point {
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
