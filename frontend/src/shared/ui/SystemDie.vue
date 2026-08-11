<template>
  <span
    class="system-die"
    :class="[`system-die--${definition.shape}`, { 'system-die--still': !animated }]"
    :style="rootStyle"
    role="img"
    :aria-label="`${definition.value}: ${shownValue}`"
  >
    <svg viewBox="0 0 56 56" aria-hidden="true">
      <defs>
        <clipPath :id="clipId">
          <path :d="shape.path" />
        </clipPath>
        <filter :id="glowId" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.8" />
        </filter>
      </defs>

      <path class="system-die__halo" :d="shape.path" />
      <path class="system-die__body" :d="shape.path" />
      <g :clip-path="`url(#${clipId})`">
        <rect
          class="system-die__liquid"
          x="0"
          :y="shape.liquidY"
          width="56"
          :height="56 - shape.liquidY"
          :filter="`url(#${glowId})`"
        />
        <rect class="system-die__shine" x="0" :y="shape.shineY" width="56" height="1.4" />

        <circle class="system-die__bubble system-die__bubble--1" cx="17" cy="49" r="2.1" />
        <circle class="system-die__bubble system-die__bubble--2" cx="31" cy="51" r="1.7" />
        <circle class="system-die__bubble system-die__bubble--3" cx="42" cy="48" r="1.9" />
      </g>
      <path class="system-die__outline" :d="shape.path" />
      <text
        class="system-die__value"
        x="28"
        :y="shape.textY"
        :style="{ fontSize: fontSize + 'px', strokeWidth: valueStrokeWidth + 'px' }"
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
    path: 'M28 5 L51 49 L5 49 Z',
    liquidY: 8,
    shineY: 7.2,
    textY: 38,
    fontSizes: [20, 17, 14, 11],
  },
  d6: {
    path: 'M14 8 H42 A6 6 0 0 1 48 14 V42 A6 6 0 0 1 42 48 H14 A6 6 0 0 1 8 42 V14 A6 6 0 0 1 14 8 Z',
    liquidY: 9,
    shineY: 8.2,
    textY: 29,
    fontSizes: [27, 21, 16, 13],
  },
  d8: {
    path: 'M28 4 L52 28 L28 52 L4 28 Z',
    liquidY: 8,
    shineY: 7.2,
    textY: 30,
    fontSizes: [26, 20, 16, 13],
  },
  d10: {
    path: 'M28 4 L50 24 L28 52 L6 24 Z',
    liquidY: 8,
    shineY: 7.2,
    textY: 31,
    fontSizes: [24, 19, 13, 11],
  },
  d12: {
    path: 'M28 5 L50.8 21.6 L42.1 48.4 L13.9 48.4 L5.2 21.6 Z',
    liquidY: 8,
    shineY: 7.2,
    textY: 31,
    fontSizes: [24, 19, 15, 12],
  },
  d20: {
    path: 'M28 4 L48.8 16 L48.8 40 L28 52 L7.2 40 L7.2 16 Z',
    liquidY: 8,
    shineY: 7.2,
    textY: 30,
    fontSizes: [25, 20, 15, 12],
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
  const lengthIndex = Math.min(4, Math.max(1, String(shownValue.value).length)) - 1
  return shape.value.fontSizes[lengthIndex]
})
const valueStrokeWidth = computed(() => {
  const length = String(shownValue.value).length
  return length >= 4 ? 2 : length === 3 ? 2.5 : 3
})
const instanceId = ++nextId
const clipId = `system-die-clip-${instanceId}`
const glowId = `system-die-glow-${instanceId}`
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
  vertical-align: middle;
}

.system-die svg { width: 100%; height: 100%; overflow: visible; }
.system-die__halo {
  fill: none;
  stroke: currentColor;
  stroke-width: 5;
  stroke-linejoin: round;
  opacity: 0.9;
}
.system-die__body {
  fill: #0d0e15;
  stroke: #3a3d4d;
  stroke-width: 2.4;
  stroke-linejoin: round;
}
.system-die__liquid {
  fill: currentColor;
  opacity: 0.92;
}
.system-die__shine {
  fill: #fff;
  opacity: 0.55;
}
.system-die__outline {
  fill: none;
  stroke: #3a3d4d;
  stroke-width: 2.4;
  stroke-linejoin: round;
}
.system-die__bubble {
  fill: rgba(255, 255, 255, 0.4);
  opacity: 0;
  animation: system-die-bubble 3.4s ease-in infinite;
  pointer-events: none;
  transform-box: fill-box;
  transform-origin: center;
}
.system-die__bubble--2 { animation-delay: 1.05s; animation-duration: 3.9s; }
.system-die__bubble--3 { animation-delay: 2.1s; animation-duration: 3.1s; }
.system-die__value {
  fill: #fff;
  stroke: #0a0b12;
  paint-order: stroke;
  font-family: "SF Mono", Consolas, "Courier New", monospace;
  font-weight: 700;
  text-anchor: middle;
  dominant-baseline: central;
  pointer-events: none;
}
.system-die--still .system-die__bubble { animation: none; }

@keyframes system-die-bubble {
  0% { transform: translateY(0) scale(0.6); opacity: 0; }
  18% { opacity: 0.6; }
  100% { transform: translateY(calc(-1 * var(--system-die-rise))) scale(1); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .system-die__bubble { animation: none !important; }
}
</style>
