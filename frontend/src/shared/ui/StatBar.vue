<template>
  <div
    class="stat-bar"
    :class="[`stat-bar--${size}`, { 'stat-bar--decorated': decorated, 'stat-bar--full': clampedPercent >= 100 }]"
    :style="{ '--bar-color': color }"
  >
    <div class="stat-bar-fill" :style="{ width: clampedPercent + '%' }">
      <template v-if="decorated">
        <span class="stat-bar-bub stat-bar-bub1"></span>
        <span class="stat-bar-bub stat-bar-bub2"></span>
      </template>
    </div>
    <div
      v-if="clampedTemp > 0"
      class="stat-bar-temp"
      :style="{ left: clampedPercent + '%', width: clampedTemp + '%', '--temp-color': tempColor }"
    ></div>
    <span v-if="decorated" class="stat-bar-shine"></span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

// Single progress/stat bar used for HP (session NPC/player rows, session player
// block, character HP) and the character LVL bar. Takes a fill color and a size.
const props = defineProps({
  // Main fill, 0–100.
  percent: { type: Number, default: 0 },
  // Fill color (any CSS color or var()). Drives fill + optional glow.
  color: { type: String, default: 'var(--accent)' },
  // 'small' (~4px thin), 'medium' (~14px pill), 'large' (~22px pill).
  size: { type: String, default: 'medium' },
  // Optional temp-HP overlay width, 0–100 (clamped so it can't exceed the remainder).
  tempPercent: { type: Number, default: 0 },
  tempColor: { type: String, default: '#5cb0e8' },
  // Character-sheet flourish: inner glow + shine line + rising bubbles.
  decorated: { type: Boolean, default: false },
})

const clampedPercent = computed(() => Math.min(100, Math.max(0, props.percent)))
const clampedTemp = computed(() =>
  Math.min(100 - clampedPercent.value, Math.max(0, props.tempPercent))
)
</script>

<style scoped>
.stat-bar {
  position: relative;
  width: 100%;
  overflow: hidden;
  box-sizing: border-box;
}

.stat-bar-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: var(--bar-color);
  transition: width 0.45s cubic-bezier(0.5, 0, 0.2, 1), background 0.3s ease;
}

.stat-bar-temp {
  position: absolute;
  top: 0;
  height: 100%;
  z-index: 2;
  background: var(--temp-color);
  transition: left 0.45s cubic-bezier(0.5, 0, 0.2, 1), width 0.45s cubic-bezier(0.5, 0, 0.2, 1);
}

/* ── small ── thin flat line (session player block, character HP compact) */
.stat-bar--small {
  height: 4px;
  border-radius: 3px;
  background: var(--bg-deep);
}
.stat-bar--small .stat-bar-fill { border-radius: 3px; }
.stat-bar--small .stat-bar-temp { opacity: 0.7; }

/* ── medium ── pill (session encounter rows, character LVL) */
.stat-bar--medium {
  height: 14px;
  border-radius: 999px;
  background: var(--bg-deep);
  border: 1px solid var(--border);
}
.stat-bar--medium .stat-bar-fill {
  border-radius: 999px 0 0 999px;
  border-right: 2px solid rgba(255, 255, 255, 0.5);
}
.stat-bar--medium.stat-bar--full .stat-bar-fill { border-radius: 999px; }
.stat-bar--medium .stat-bar-temp {
  opacity: 0.85;
  border-right: 2px solid rgba(255, 255, 255, 0.45);
}

/* ── large ── tall pill (character HP widget) */
.stat-bar--large {
  height: 22px;
  border-radius: 999px;
  background: #0d0e15;
  border: 1.5px solid #3a3d4d;
}
.stat-bar--large .stat-bar-fill {
  border-radius: 999px 0 0 999px;
  border-right: 2px solid rgba(255, 255, 255, 0.55);
}
.stat-bar--large.stat-bar--full .stat-bar-fill { border-radius: 999px; }
.stat-bar--large .stat-bar-temp {
  border-right: 2px solid rgba(255, 255, 255, 0.6);
}

/* ── decorated flourish (glow + shine + bubbles) ── */
.stat-bar--decorated .stat-bar-fill { box-shadow: 0 0 11px var(--bar-color); }
.stat-bar-shine {
  position: absolute;
  top: 3px;
  left: 9px;
  right: 9px;
  height: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  pointer-events: none;
  z-index: 4;
}
.stat-bar-bub {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.45);
  z-index: 3;
  pointer-events: none;
}
.stat-bar-bub1 { left: 30%; bottom: 3px; width: 4px; height: 4px; animation: stat-bar-rise 3.6s ease-in infinite; }
.stat-bar-bub2 { left: 70%; bottom: 2px; width: 3px; height: 3px; animation: stat-bar-rise 4.4s ease-in 1s infinite; }
@keyframes stat-bar-rise {
  0% { transform: translateY(0) scale(0.6); opacity: 0; }
  20% { opacity: 0.6; }
  100% { transform: translateY(-12px) scale(1); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .stat-bar-bub { animation: none !important; }
}
</style>
