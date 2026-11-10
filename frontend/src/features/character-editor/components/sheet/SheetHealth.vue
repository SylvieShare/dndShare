<template>
  <span class="heading-health" data-tutorial="character-hp" :style="{ '--health-color': color }"
    role="progressbar" aria-label="Здоровье" :aria-valuemin="0" :aria-valuemax="Math.max(maximum, current)"
    :aria-valuenow="current" :aria-valuetext="current + ' из ' + maximum + (temporary ? ', временные ' + temporary : '')">
    <span class="health-readout"><span class="health-heart" aria-hidden="true" />
      <strong>{{ current }}</strong><span class="health-maximum"> / {{ maximum }}</span>
      <span v-if="temporary" class="health-temporary"> +{{ temporary }}</span>
    </span>
    <span ref="track" class="health-track" aria-hidden="true"><canvas ref="canvas" /></span>
  </span>
</template>
<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { createHealthMistRenderer } from './healthMistRenderer'
const props = defineProps({ current: Number, maximum: Number, temporary: Number })
const fill = computed(() => props.maximum > 0 ? Math.max(0, Math.min(1, props.current / props.maximum)) : 0)
const color = computed(() => fill.value > .6 ? 'var(--success)' : fill.value > .25 ? 'var(--warning)' : 'var(--danger)')
const canvas = ref(null), track = ref(null)
let renderer
function update() {
  if (!renderer) return
  const style = getComputedStyle(track.value)
  renderer.update({ fill: fill.value,
    temporary: props.maximum > 0 ? Math.max(0, Math.min(1 - fill.value, props.temporary / props.maximum)) : 0,
    color: style.color,
    temporaryColor: getComputedStyle(canvas.value).color,
  })
}
onMounted(() => { renderer = createHealthMistRenderer(canvas.value, track.value); update() })
watch(() => [props.current, props.maximum, props.temporary], update, { flush: 'post' })
onBeforeUnmount(() => renderer?.destroy())
</script>
<style scoped>
.heading-health {grid-column:1/-1;display:flex;align-items:center;gap:8px;min-width:0;container-type:inline-size;color:var(--health-color)}
.health-readout {display:inline-flex;align-items:baseline;gap:3px;flex:0 1 auto;min-width:0;white-space:nowrap;font-variant-numeric:lining-nums tabular-nums}
.health-heart {align-self:center;width:var(--layout-sheet-health-icon);height:var(--layout-sheet-health-icon);margin-right:3px;background:currentColor;mask:url('/static/hp-pulse.svg') center/contain no-repeat}
.health-readout strong {font-family:var(--type-sheet-health-family);font-size:var(--type-sheet-health-size);font-weight:var(--type-sheet-health-weight);line-height:var(--type-sheet-health-line-height)}
.health-maximum {font-size:12px;color:var(--text-muted)}
.health-temporary {font-size:12px;color:var(--info);font-weight:700}
.health-track {display:block;position:relative;flex:1;min-width:32px;height:var(--layout-sheet-health-height);box-sizing:border-box;border:1px solid currentColor;border-radius:var(--radius-input);overflow:hidden;background:var(--bg)}
.health-track canvas {position:absolute;inset:0;display:block;width:100%;height:100%;color:var(--info)}
@container (max-width:150px) {.health-readout {flex-wrap:wrap}.health-track {min-width:24px}}
</style>
