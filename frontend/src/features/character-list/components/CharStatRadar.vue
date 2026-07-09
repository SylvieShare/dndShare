<template>
  <div class="radar">
    <svg class="radar-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <!-- grid: outer hexagon + a mid ring + spokes -->
      <polygon class="radar-grid" :points="gridPoints(1)" />
      <polygon class="radar-grid radar-grid--mid" :points="gridPoints(0.5)" />
      <line
        v-for="(p, i) in axisTips"
        :key="'spoke' + i"
        class="radar-spoke"
        x1="50"
        y1="50"
        :x2="p.x"
        :y2="p.y"
      />
      <!-- value polygon -->
      <polygon class="radar-shape" :points="valuePoints" />
      <circle
        v-for="(p, i) in valueTips"
        :key="'dot' + i"
        class="radar-dot"
        :cx="p.x"
        :cy="p.y"
        r="1.5"
      />
    </svg>

    <!-- axis icons, fixed at the outer rim vertices (centered on each) -->
    <div
      v-for="(a, i) in axes"
      :key="a.id"
      class="radar-axis"
      :style="{ left: axisTips[i].x + '%', top: axisTips[i].y + '%' }"
    >
      <SvgIcon v-if="a.svg" class="radar-icon" :svg="a.svg" :color="a.color || 'var(--text-2)'" :size="16" />
      <span v-else class="radar-abbr">{{ a.id }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SvgIcon from '@/shared/ui/SvgIcon'

const props = defineProps({
  // [{ id, score, svg, color }] in axis order (6 entries for D&D).
  axes: { type: Array, default: () => [] },
  // Score mapped to full radius.
  max: { type: Number, default: 20 },
})

const CENTER = 50
// Leaves room for the rim icons to stay fully inside the box.
const GRID_R = 42

function angle(i) {
  return (-90 + i * (360 / props.axes.length)) * Math.PI / 180
}

function at(i, r) {
  return { x: CENTER + r * Math.cos(angle(i)), y: CENTER + r * Math.sin(angle(i)) }
}

function ratio(score) {
  const r = (Number(score) || 0) / props.max
  return Math.max(0, Math.min(1, r))
}

const axisTips = computed(() => props.axes.map((_, i) => at(i, GRID_R)))
const valueTips = computed(() => props.axes.map((a, i) => at(i, ratio(a.score) * GRID_R)))

const valuePoints = computed(() => valueTips.value.map(p => `${p.x},${p.y}`).join(' '))

function gridPoints(scale) {
  return props.axes.map((_, i) => {
    const p = at(i, GRID_R * scale)
    return `${p.x},${p.y}`
  }).join(' ')
}
</script>

<style scoped>
.radar {
  position: relative;
  width: 118px;
  height: 118px;
  flex-shrink: 0;
}

.radar-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.radar-grid {
  fill: none;
  stroke: var(--border-strong);
  stroke-width: 0.7;
}

.radar-grid--mid {
  stroke: var(--border);
}

.radar-spoke {
  stroke: var(--border);
  stroke-width: 0.6;
}

.radar-shape {
  fill: color-mix(in srgb, var(--accent) 24%, transparent);
  stroke: var(--accent);
  stroke-width: 1.1;
  stroke-linejoin: round;
}

.radar-dot {
  fill: var(--accent);
}

.radar-axis {
  position: absolute;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
  pointer-events: none;
}

.radar-icon {
  width: 16px;
  height: 16px;
}

.radar-abbr {
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--text-2);
}
</style>
