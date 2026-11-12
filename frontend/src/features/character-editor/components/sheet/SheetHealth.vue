<template>
  <span class="heading-health" role="group" data-tutorial="character-hp"
    :class="{ 'heading-health--paused': pageHidden }"
    :style="{ '--health-color': color }" :aria-label="description" title="Здоровье">
    <svg ref="pulseSvg" class="health-beat" viewBox="0 0 128 32" preserveAspectRatio="none" aria-hidden="true" @animationstart="updatePulseRate">
      <path class="health-beat-ink health-beat-memory" :d="beatPath" pathLength="1" />
      <path class="health-beat-ink health-beat-trail" :d="beatPath" pathLength="1" />
      <path class="health-beat-ink health-beat-head" :d="beatPath" pathLength="1" />
    </svg>
    <span class="health-summary">
      <Heart class="health-heart" aria-hidden="true" :stroke-width="1.6" />
      <span class="health-readout"><strong>{{ current }}</strong><small>/{{ maximum }}</small></span>
    </span>
    <small v-if="temporary" class="health-temporary" :title="'Временные HP: ' + temporary">+{{ temporary }}</small>
  </span>
</template>
<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { motionTokens } from '@/app/design-tokens'
import { Heart } from '@lucide/vue'
const props = defineProps({ current: Number, maximum: Number, temporary: Number })
const beatPath = 'M0 17H32L42 12L49 22L59 4L69 28L78 17H128'
const pulseSvg = ref(null)
const pageHidden = ref(typeof document !== 'undefined' && document.hidden)
function updateVisibility() { pageHidden.value = document.hidden }
function updatePulseRate() {
  for (const animation of pulseSvg.value?.getAnimations({ subtree: true }) || []) {
    animation.updatePlaybackRate(pulseRate.value)
  }
}
onMounted(() => {
  updateVisibility()
  updatePulseRate()
  document.addEventListener('visibilitychange', updateVisibility)
})
onBeforeUnmount(() => document.removeEventListener('visibilitychange', updateVisibility))
const fill = computed(() => props.maximum > 0 ? Math.max(0, Math.min(1, props.current / props.maximum)) : 0)
const pulseRate = computed(() => {
  const slow = motionTokens['sheet-health-pulse'], fast = motionTokens['sheet-health-pulse-fast']
  return slow / (fast + (slow - fast) * fill.value)
})
watch(pulseRate, updatePulseRate, { flush: 'post' })
const color = computed(() => fill.value > .6 ? 'var(--success)' : fill.value > .25 ? 'var(--warning)' : 'var(--danger)')
const description = computed(() => 'Здоровье: ' + props.current + ' из ' + props.maximum + (props.temporary ? ', временные ' + props.temporary : ''))
</script>
<style scoped>
.heading-health {position:relative;isolation:isolate;display:inline-flex;flex:none;align-items:center;gap:var(--spacing-xs);height:var(--layout-sheet-health-height);box-sizing:border-box;min-width:0;padding:0 var(--spacing-label);overflow:hidden;border:var(--layout-border) solid color-mix(in srgb,var(--health-color) 32%,transparent);border-radius:var(--radius-input);background:color-mix(in srgb,var(--health-color) 5%,transparent);white-space:nowrap;font-family:var(--type-sheet-health-family);font-size:var(--type-sheet-health-size);font-weight:var(--type-sheet-health-weight);line-height:var(--type-sheet-health-line-height);font-variant-numeric:lining-nums tabular-nums}
.health-beat {position:absolute;inset:0;width:100%;height:100%;pointer-events:none;color:var(--health-color)}
.health-beat-ink {fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;opacity:0;animation-duration:var(--motion-sheet-health-pulse);animation-timing-function:linear;animation-iteration-count:infinite}
.health-beat-memory {stroke-dasharray:1 1;stroke-dashoffset:1;animation-name:health-beat-draw}
.health-beat-trail {stroke-dasharray:.18 1;stroke-dashoffset:.18;animation-name:health-beat-trail}
.health-beat-head {stroke-width:2.4;stroke-dasharray:.012 1;stroke-dashoffset:.012;animation-name:health-beat-head}
.heading-health--paused .health-beat-ink {animation-play-state:paused}
.health-summary,.health-temporary {position:relative;z-index:1}
.health-summary {display:inline-flex;align-items:center;gap:3px;flex:none;white-space:nowrap}
.health-heart {flex:none;width:var(--layout-sheet-health-icon);height:var(--layout-sheet-health-icon);stroke:var(--health-color);fill:color-mix(in srgb,var(--health-color) 18%,transparent)}
.health-readout {display:inline-flex;align-items:baseline;gap:1px}
.health-readout strong {color:var(--health-color);font-weight:inherit}
.health-readout small {font-size:var(--type-context-size);line-height:var(--type-context-line-height);font-weight:500;color:var(--text-muted)}
.health-temporary {font-family:var(--type-context-family);font-size:var(--type-context-size);line-height:var(--type-context-line-height);font-weight:600;color:color-mix(in srgb,var(--info) 85%,var(--text-1))}
@keyframes health-beat-draw {
  0% {stroke-dashoffset:1;opacity:0}
  5% {opacity:.035}
  55% {stroke-dashoffset:0;opacity:.035}
  70%,100% {stroke-dashoffset:0;opacity:0}
}
@keyframes health-beat-trail {
  0% {stroke-dashoffset:.18;opacity:0}
  5% {opacity:.12}
  55% {stroke-dashoffset:-.82;opacity:.12}
  70%,100% {stroke-dashoffset:-.82;opacity:0}
}
@keyframes health-beat-head {
  0% {stroke-dashoffset:.012;opacity:0}
  5% {opacity:.24}
  55% {stroke-dashoffset:-.988;opacity:.24}
  70%,100% {stroke-dashoffset:-.988;opacity:0}
}
@media (prefers-reduced-motion: reduce) {
  .health-beat-ink {animation:none}
  .health-beat-memory {stroke-dashoffset:0;opacity:.09}
}
</style>
