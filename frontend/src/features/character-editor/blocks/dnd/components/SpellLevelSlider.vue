<template>
  <div class="spell-level-picker">
    <div ref="track" class="spell-level-track" role="slider" tabindex="0" aria-label="Круг ячейки"
      aria-valuemin="1" aria-valuemax="9" :aria-valuenow="modelValue || 1" :aria-valuetext="`${modelValue || 1} круг`" :aria-disabled="!allowed.length"
      @pointerdown="begin" @pointermove="move" @pointerup="finish" @pointercancel="finish" @keydown="onKey">
      <span v-for="level in 9" :key="level" class="spell-level-sector" :class="{ selected: level === modelValue, unavailable: !allowed.includes(level) }" :data-level="level" :aria-hidden="true">{{ level }}</span>
    </div>
    <span class="spell-level-caption">{{ modelValue }} круг</span>
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
function begin(event) { if (event.button !== 0) return; dragging.value = true; track.value.setPointerCapture(event.pointerId); track.value.focus(); select(event) }
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
.spell-level-picker { display: grid; gap: 6px; }
.spell-level-track { display: grid; grid-template-columns: repeat(9, minmax(0, 1fr)); border: 1px solid var(--border); border-radius: 7px; overflow: hidden; touch-action: none; cursor: ew-resize; user-select: none; }
.spell-level-track:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.spell-level-sector { display: grid; place-items: center; min-height: 32px; border-right: 1px solid var(--border); font-size: 13px; background: var(--bg-input); }
.spell-level-sector:last-child { border-right: 0; }
.spell-level-sector.selected { background: var(--accent); color: var(--text-on-accent); font-weight: 700; }
.spell-level-sector.unavailable { color: var(--text-muted); opacity: .35; background: repeating-linear-gradient(135deg, transparent, transparent 3px, var(--border) 3px, var(--border) 4px); }
.spell-level-caption { color: var(--text-muted); font-size: 12px; }
</style>
