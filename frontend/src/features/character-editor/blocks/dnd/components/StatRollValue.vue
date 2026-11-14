<template>
  <span class="stat-roll-value" :class="{ 'stat-roll-value--mode': hasMode, 'stat-roll-value--primary': primary, 'stat-roll-value--compact': compact, 'stat-roll-value--active': active }"
    :style="{ '--stat-roll-mode-color': mode === 'advantage' ? 'var(--success)' : 'var(--danger)' }">
    <span class="stat-roll-value__number" data-stat-roll-number><slot /></span>
    <span class="stat-roll-value__mode"><RollModeBadge :mode="mode" :source="source" :cancelled="cancelled" variant="marker" embedded /></span>
  </span>
</template>
<script setup>
import { computed } from 'vue'
import RollModeBadge from './RollModeBadge.vue'
const props = defineProps({ mode: { type: String, default: 'normal' }, source: String, cancelled: Boolean, primary: Boolean, compact: Boolean, active: Boolean })
const hasMode = computed(() => !props.cancelled && ['advantage', 'disadvantage'].includes(props.mode))
</script>
<style scoped>
.stat-roll-value {--stat-roll-height:var(--layout-sheet-value-height);--roll-mode-marker-size:var(--layout-roll-mode-marker);position:relative;isolation:isolate;display:inline-grid;grid-template-columns:minmax(0,1fr) var(--roll-mode-marker-size);align-items:center;column-gap:var(--spacing-xs);flex:none;width:max-content;max-width:100%;min-width:0;min-height:var(--stat-roll-height);border-radius:var(--radius-input);background:var(--surface-raised);box-shadow:var(--stat-roll-focus-ring,none);transition:background-color var(--motion-feedback),box-shadow var(--motion-feedback)}
.stat-roll-value--compact {--stat-roll-height:var(--layout-sheet-value-compact-height);--roll-mode-marker-size:var(--layout-roll-mode-marker-compact)}
.stat-roll-value--primary {min-height:0}
.stat-roll-value__mode {display:flex;align-items:center;justify-content:center;width:var(--roll-mode-marker-size);min-width:0}
.stat-roll-value--primary,.stat-roll-value--mode {background:transparent}
.stat-roll-value--mode::before {content:"";position:absolute;inset:0;z-index:-1;border-radius:var(--radius-input);background:color-mix(in srgb,var(--stat-roll-mode-color) 12%,transparent)}
.stat-roll-value__number {display:inline-flex;align-items:center;min-width:0;border-radius:var(--radius-input);background:transparent}
.stat-roll-value:not(.stat-roll-value--mode):hover {background:var(--surface-active)}
.stat-roll-value--active {box-shadow:0 0 0 var(--layout-border) var(--accent-soft)}
.stat-roll-value--active:not(.stat-roll-value--mode) {background:color-mix(in srgb,var(--accent) 16%,var(--surface-raised))}
.stat-roll-value--mode:hover::before {background:color-mix(in srgb,var(--stat-roll-mode-color) 18%,transparent)}
@media (prefers-reduced-motion: reduce) {.stat-roll-value {transition:none}}
</style>
