<template>
  <span class="heading-health" role="group" data-tutorial="character-hp"
    :style="{ '--health-color': color }" :aria-label="description" title="Здоровье">
    <span class="health-summary"><span class="health-heart" aria-hidden="true" />
      <span class="health-readout"><strong>{{ current }}</strong><small>/{{ maximum }}</small></span>
    </span>
    <StatBar class="health-strip" label="Заполнение здоровья" size="compact" :percent="fill * 100" :color="color"
      :temp-percent="temporaryFill * 100" temp-color="var(--info)" />
    <small v-if="temporary" class="health-temporary" :title="'Временные HP: ' + temporary">+{{ temporary }}</small>
  </span>
</template>
<script setup>
import { computed } from 'vue'
import { StatBar } from '@sylvieshare/share-ui'
const props = defineProps({ current: Number, maximum: Number, temporary: Number })
const fill = computed(() => props.maximum > 0 ? Math.max(0, Math.min(1, props.current / props.maximum)) : 0)
const temporaryFill = computed(() => props.maximum > 0 ? Math.max(0, Math.min(1 - fill.value, props.temporary / props.maximum)) : 0)
const color = computed(() => fill.value > .6 ? 'var(--success)' : fill.value > .25 ? 'var(--warning)' : 'var(--danger)')
const description = computed(() => 'Здоровье: ' + props.current + ' из ' + props.maximum + (props.temporary ? ', временные ' + props.temporary : ''))
</script>
<style scoped>
.heading-health {grid-column:1/-1;display:flex;align-items:center;gap:8px;min-width:0;font-variant-numeric:lining-nums tabular-nums}
.health-summary {display:inline-flex;align-items:center;gap:3px;flex:none;white-space:nowrap}
.health-strip {flex:1;min-width:24px}
.health-heart {flex:none;width:var(--layout-sheet-health-icon);height:var(--layout-sheet-health-icon);background:var(--health-color);mask:url('/static/hp-pulse.svg') center/contain no-repeat}
.health-readout {display:inline-flex;align-items:baseline;gap:1px}
.health-readout strong {font-family:var(--type-sheet-health-family);font-size:var(--type-sheet-health-size);font-weight:var(--type-sheet-health-weight);line-height:var(--type-sheet-health-line-height)}
.health-readout small {font-family:var(--type-context-family);font-size:var(--type-context-size);font-weight:var(--type-context-weight);color:var(--text-muted)}
.health-temporary {font-size:var(--type-context-size);font-weight:600;color:color-mix(in srgb,var(--info) 85%,var(--text-1))}
</style>
