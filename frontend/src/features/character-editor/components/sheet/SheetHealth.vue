<template>
  <span class="heading-health" role="group" data-tutorial="character-hp"
    :style="{ '--health-color': color, '--health-digits': digits }" :aria-label="description" title="Здоровье">
    <span class="health-summary"><span class="health-heart" aria-hidden="true" />
      <span class="health-readout"><strong>{{ current }}</strong><small>/{{ maximum }}</small></span>
    </span>
    <small v-if="temporary" class="health-temporary" :title="'Временные HP: ' + temporary">+{{ temporary }}</small>
  </span>
</template>
<script setup>
import { computed } from 'vue'
const props = defineProps({ current: Number, maximum: Number, temporary: Number })
const fill = computed(() => props.maximum > 0 ? Math.max(0, Math.min(1, props.current / props.maximum)) : 0)
const digits = computed(() => Math.max(2, String(Math.max(Math.abs(props.current || 0), Math.abs(props.maximum || 0))).length))
const color = computed(() => fill.value > .6 ? 'var(--success)' : fill.value > .25 ? 'var(--warning)' : 'var(--danger)')
const description = computed(() => 'Здоровье: ' + props.current + ' из ' + props.maximum + (props.temporary ? ', временные ' + props.temporary : ''))
</script>
<style scoped>
.heading-health {display:inline-flex;flex:none;align-items:center;gap:6px;min-width:0;white-space:nowrap;font-family:var(--type-sheet-health-family);font-size:var(--type-sheet-health-size);font-weight:var(--type-sheet-health-weight);line-height:var(--type-sheet-health-line-height);font-variant-numeric:lining-nums tabular-nums}
.health-summary {display:inline-flex;align-items:center;gap:3px;flex:none;white-space:nowrap}
.health-heart {flex:none;width:var(--layout-sheet-health-icon);height:var(--layout-sheet-health-icon);background:var(--health-color);mask:url('/static/hp-pulse.svg') center/contain no-repeat}
.health-readout {display:inline-flex;align-items:baseline;gap:1px}
/* ch measures the default zero; half-em cells also fit Cormorant's tabular figures. */
.health-readout strong {min-width:calc(var(--health-digits) * .5em);text-align:right;color:var(--health-color);font-weight:inherit}
.health-readout small {font-size:.8em;font-weight:600;color:var(--text-muted)}
.health-temporary {font-family:var(--type-context-family);font-size:var(--type-context-size);line-height:var(--type-context-line-height);font-weight:600;color:color-mix(in srgb,var(--info) 85%,var(--text-1))}
</style>
