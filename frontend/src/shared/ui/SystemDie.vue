<template>
  <span
    class="system-die"
    :class="[`system-die--${definition.shape}`, { 'system-die--still': !animated }]"
    :style="rootStyle"
    role="img"
    :aria-label="`${definition.value}: ${shownValue}`"
  >
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <clipPath :id="clipId">
          <path :d="shape.path" />
        </clipPath>
      </defs>
      <path class="system-die__body" :d="shape.path" />
      <g :clip-path="`url(#${clipId})`">
        <ellipse class="system-die__shine" cx="22" cy="16" rx="13" ry="8" />
        <circle class="system-die__bubble system-die__bubble--1" cx="18" cy="49" r="3.2" />
        <circle class="system-die__bubble system-die__bubble--2" cx="35" cy="54" r="2.4" />
        <circle class="system-die__bubble system-die__bubble--3" cx="47" cy="47" r="2.8" />
      </g>
      <path v-for="line in shape.facets" :key="line" class="system-die__facet" :d="line" />
      <text
        class="system-die__value"
        x="32"
        :y="shape.textY"
        :style="{ fontSize: fontSize + 'px' }"
      >{{ shownValue }}</text>
    </svg>
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { diceByValue, SYSTEM_DICE } from '@/shared/lib/systemDice'

let nextId = 0

const SHAPES = {
  d4: {
    path: 'M32 4 L61 57 H3 Z',
    facets: ['M32 4 L32 57', 'M3 57 L32 38 L61 57'],
    textY: 45,
  },
  d6: {
    path: 'M32 3 L56 16 L56 48 L32 61 L8 48 L8 16 Z',
    facets: ['M8 16 L32 30 L56 16', 'M32 30 L32 61'],
    textY: 39,
  },
  d8: {
    path: 'M32 3 L60 32 L32 61 L4 32 Z',
    facets: ['M4 32 L32 20 L60 32', 'M32 20 L32 61'],
    textY: 40,
  },
  d10: {
    path: 'M32 2 L58 24 L51 52 L32 62 L13 52 L6 24 Z',
    facets: ['M6 24 L32 17 L58 24', 'M13 52 L32 17 L51 52', 'M32 17 L32 62'],
    textY: 40,
  },
  d12: {
    path: 'M32 2 L48 7 L59 20 L61 37 L52 53 L37 61 L20 58 L7 48 L2 32 L7 16 L20 5 Z',
    facets: ['M20 5 L18 24 L32 35 L48 25 L48 7', 'M18 24 L7 48', 'M32 35 L37 61', 'M48 25 L52 53'],
    textY: 42,
  },
  d20: {
    path: 'M32 2 L49 8 L60 24 L58 43 L45 58 L25 62 L8 51 L3 33 L10 15 Z',
    facets: ['M10 15 L32 19 L49 8', 'M3 33 L32 19 L60 24', 'M8 51 L32 19 L58 43', 'M25 62 L32 19 L45 58'],
    textY: 39,
  },
}

const props = defineProps({
  sides: { type: [Number, String], default: 20 },
  value: { type: [Number, String], default: null },
  size: { type: Number, default: 42 },
  color: { type: String, default: null },
  animated: { type: Boolean, default: true },
})

const fallback = SYSTEM_DICE.find((die) => die.sides === 20)
const definition = computed(() => diceByValue(props.sides) || fallback)
const shape = computed(() => SHAPES[definition.value.shape] || SHAPES.d20)
const shownValue = computed(() => props.value ?? definition.value.sides)
const fontSize = computed(() => {
  const length = String(shownValue.value).length
  return length >= 4 ? 14 : length === 3 ? 17 : length === 2 ? 21 : 24
})
const clipId = `system-die-clip-${++nextId}`
const rootStyle = computed(() => ({
  '--system-die-color': props.color || definition.value.color,
  '--system-die-rise': `${Math.max(12, props.size * 0.56)}px`,
  width: `${props.size}px`,
  height: `${props.size}px`,
}))
</script>

<style scoped>
.system-die {
  display: inline-flex;
  flex: 0 0 auto;
  color: var(--system-die-color);
  filter: drop-shadow(0 2px 4px color-mix(in srgb, var(--system-die-color) 18%, transparent));
  vertical-align: middle;
}

.system-die svg { width: 100%; height: 100%; overflow: visible; }
.system-die__body {
  fill: color-mix(in srgb, var(--system-die-color) 48%, #10121a);
  stroke: color-mix(in srgb, var(--system-die-color) 82%, white);
  stroke-width: 2;
  stroke-linejoin: round;
}
.system-die__facet {
  fill: none;
  stroke: color-mix(in srgb, var(--system-die-color) 36%, #10121a);
  stroke-width: 1.25;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0.75;
}
.system-die__shine { fill: rgba(255, 255, 255, 0.15); transform: rotate(-18deg); transform-origin: center; }
.system-die__bubble {
  fill: rgba(255, 255, 255, 0.48);
  opacity: 0;
  animation: system-die-bubble 3.4s ease-in infinite;
}
.system-die__bubble--2 { animation-delay: 1.05s; animation-duration: 3.9s; }
.system-die__bubble--3 { animation-delay: 2.1s; animation-duration: 3.1s; }
.system-die__value {
  fill: white;
  stroke: color-mix(in srgb, var(--system-die-color) 28%, #10121a);
  stroke-width: 1.5px;
  paint-order: stroke fill;
  font-family: ui-rounded, "SF Pro Rounded", system-ui, sans-serif;
  font-weight: 850;
  text-anchor: middle;
  dominant-baseline: middle;
  pointer-events: none;
}
.system-die--still .system-die__bubble { animation: none; }

@keyframes system-die-bubble {
  0% { transform: translateY(0) scale(0.55); opacity: 0; }
  18% { opacity: 0.58; }
  100% { transform: translateY(calc(-1 * var(--system-die-rise))) scale(1); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .system-die__bubble { animation: none !important; }
}
</style>
