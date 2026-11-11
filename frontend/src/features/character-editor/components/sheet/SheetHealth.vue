<template>
  <span class="heading-health" data-tutorial="character-hp" :style="{ '--health-color': color }"
    role="progressbar" aria-label="Здоровье" :aria-valuemin="0" :aria-valuemax="Math.max(1, maximum, current)"
    :aria-valuenow="Math.max(0, current)" :aria-valuetext="current + ' из ' + maximum + (temporary ? ', временные ' + temporary : '')">
    <span ref="track" class="health-track"><canvas ref="canvas" aria-hidden="true" />
      <span class="health-overlay">
        <span class="health-readout"><span class="health-heart" aria-hidden="true" />
          <strong>{{ current }}</strong><span class="health-maximum"> / {{ maximum }}</span>
        </span>
        <span v-if="temporary" class="health-temporary" :title="'Временные HP: ' + temporary"><Shield :size="12" aria-hidden="true" />+{{ temporary }}</span>
      </span>
    </span>
  </span>
</template>
<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Shield } from '@lucide/vue'
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
.heading-health {grid-column:1/-1;display:block;min-width:0;color:var(--health-color)}
.health-overlay {position:relative;z-index:1;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:2px 8px;box-sizing:border-box;min-height:calc(var(--layout-sheet-health-height) - 2px);padding:2px 8px}
.health-readout {position:relative;isolation:isolate;display:inline-flex;flex-wrap:wrap;align-items:baseline;gap:3px;max-width:100%;min-width:0;white-space:nowrap;color:var(--text-1);text-shadow:0 1px 3px var(--bg);font-variant-numeric:lining-nums tabular-nums}
.health-readout::before {content:'';position:absolute;inset:-3px -24px -3px -8px;z-index:-1;background:linear-gradient(90deg,color-mix(in srgb,var(--bg) 84%,transparent),color-mix(in srgb,var(--bg) 65%,transparent) 60%,transparent)}
.health-heart {align-self:center;flex:none;width:var(--layout-sheet-health-icon);height:var(--layout-sheet-health-icon);margin-right:3px;background:color-mix(in srgb,var(--health-color) 55%,var(--text-1));mask:url('/static/hp-pulse.svg') center/contain no-repeat}
.health-readout strong {font-family:var(--type-sheet-health-family);font-size:var(--type-sheet-health-size);font-weight:var(--type-sheet-health-weight);line-height:var(--type-sheet-health-line-height)}
.health-maximum {font-size:12px;color:var(--text-2)}
.health-temporary {display:inline-flex;align-items:center;gap:3px;flex:none;margin-left:auto;padding:2px 5px;border-radius:var(--radius-xs);background:color-mix(in srgb,var(--info) 18%,var(--bg));font-size:12px;line-height:18px;color:var(--info);font-weight:700;white-space:nowrap;font-variant-numeric:tabular-nums}
.health-track {display:block;position:relative;box-sizing:border-box;border:1px solid currentColor;border-radius:var(--radius-input);overflow:hidden;background:var(--bg)}
.health-track canvas {position:absolute;inset:0;display:block;width:100%;height:100%;color:var(--info)}
</style>
