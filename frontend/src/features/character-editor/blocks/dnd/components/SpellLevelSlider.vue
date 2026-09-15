<template>
  <div ref="track" class="spell-level-track" :class="{ dragging, disabled: !allowed.length }"
    :style="{ '--thumb-position': `${((modelValue || 1) - .5) / 9 * 100}%` }"
    role="slider" tabindex="0" aria-label="Круг ячейки"
    aria-valuemin="1" aria-valuemax="9" :aria-valuenow="modelValue || 1"
    :aria-valuetext="`${modelValue || 1} круг`" :aria-disabled="!allowed.length"
    @pointerdown="begin" @pointermove="move" @pointerup="finish" @pointercancel="finish"
    @lostpointercapture="finish" @keydown="onKey">
    <span class="spell-level-axis" aria-hidden="true" />
    <span class="spell-level-progress" aria-hidden="true" />
    <span v-for="level in 9" :key="level" class="spell-level-sector"
      :class="{ selected: level === modelValue, unavailable: !allowed.includes(level) }"
      :data-level="level" aria-hidden="true">
      <span class="spell-level-point" />
      <span class="spell-level-number">{{ level }}</span>
    </span>
    <span class="spell-level-thumb" aria-hidden="true">{{ modelValue || 1 }}</span>
  </div>
</template>
<script setup>
import { ref } from 'vue'
const props = defineProps({ modelValue: Number, allowed: { type: Array, default: () => [] } })
const emit = defineEmits(['update:modelValue'])
const track = ref(null), dragging = ref(false)
function select(event) {
  const box = track.value.getBoundingClientRect()
  const level = Math.max(1, Math.min(9, Math.floor((event.clientX - box.left) / box.width * 9) + 1))
  if (props.allowed.includes(level)) emit('update:modelValue', level)
}
function begin(event) {
  if (event.button !== 0 || !props.allowed.length) return
  dragging.value = true
  track.value.setPointerCapture(event.pointerId)
  track.value.focus()
  select(event)
}
function move(event) { if (dragging.value) select(event) }
function finish() { dragging.value = false }
function onKey(event) {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const levels = [...props.allowed].sort((a, b) => a - b)
  const next = event.key === 'Home' ? levels[0] : event.key === 'End' ? levels.at(-1)
    : ['ArrowRight', 'ArrowUp'].includes(event.key) ? levels.find(n => n > props.modelValue) : levels.filter(n => n < props.modelValue).at(-1)
  if (next != null) emit('update:modelValue', next)
}
</script>
<style scoped>
.spell-level-track {
  position: relative;
  display: grid;
  grid-template-columns: repeat(9, minmax(0, 1fr));
  height: 58px;
  isolation: isolate;
  border-radius: 12px;
  touch-action: none;
  cursor: grab;
  user-select: none;
}
.spell-level-track.dragging { cursor: grabbing; }
.spell-level-track.disabled { opacity: .45; cursor: default; }
.spell-level-track:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.spell-level-axis, .spell-level-progress {
  position: absolute;
  top: 20px;
  left: calc(100% / 18);
  height: 3px;
  border-radius: 3px;
  transform: translateY(-50%);
  pointer-events: none;
  z-index: -1;
}
.spell-level-axis { right: calc(100% / 18); background: var(--border-strong); }
.spell-level-progress {
  width: calc(var(--thumb-position) - 100% / 18);
  background: color-mix(in srgb, var(--accent) 65%, var(--border-strong));
  transition: width .14s ease;
}
.spell-level-sector { position: relative; display: flex; align-items: center; flex-direction: column; padding-top: 14px; }
.spell-level-point {
  width: 12px;
  height: 12px;
  box-sizing: border-box;
  border: 2px solid var(--accent);
  border-radius: 50%;
  background: radial-gradient(circle at 35% 25%, var(--accent-soft), var(--accent));
  box-shadow: 0 0 0 3px var(--surface-raised);
}
.spell-level-number { margin-top: 12px; color: var(--text-2); font-size: 12px; line-height: 16px; }
.spell-level-sector.selected .spell-level-number { visibility: hidden; }
.spell-level-sector.unavailable .spell-level-point { background: var(--surface-raised); border-color: var(--border-strong); }
.spell-level-sector.unavailable .spell-level-number { color: var(--text-muted); opacity: .45; }
.spell-level-thumb {
  position: absolute;
  top: 20px;
  left: var(--thumb-position);
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  box-sizing: border-box;
  border: 2px solid color-mix(in srgb, var(--accent-soft) 70%, var(--accent));
  border-radius: 50%;
  background: radial-gradient(circle at 35% 20%, color-mix(in srgb, var(--accent-soft) 35%, var(--accent)), var(--accent) 75%);
  color: var(--text-on-accent);
  font-size: 14px;
  font-weight: 700;
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 12%, transparent), 0 3px 8px color-mix(in srgb, var(--accent) 24%, transparent);
  transform: translate(-50%, -50%);
  transition: left .14s ease, box-shadow .14s ease;
  pointer-events: none;
}
.spell-level-track.dragging .spell-level-thumb { box-shadow: 0 0 0 6px color-mix(in srgb, var(--accent) 18%, transparent); }
.spell-level-track.dragging .spell-level-thumb, .spell-level-track.dragging .spell-level-progress { transition-duration: .06s; }
@media (prefers-reduced-motion: reduce) {
  .spell-level-thumb, .spell-level-progress { transition: none; }
}
</style>
