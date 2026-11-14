<template>
  <span class="stat-roll-value" :class="{ 'stat-roll-value--mode': hasMode, 'stat-roll-value--primary': primary, 'stat-roll-value--compact': compact, 'stat-roll-value--active': active, 'stat-roll-value--stacked': stacked }"
    :style="{ '--stat-roll-mode-color': mode === 'advantage' ? 'var(--success)' : 'var(--danger)' }">
    <RollModeBadge v-if="!primary" :mode="mode" :source="source" :cancelled="cancelled" embedded />
    <span class="stat-roll-value__number" data-stat-roll-number><slot /></span>
    <RollModeBadge v-if="primary" :mode="mode" :source="source" :cancelled="cancelled" variant="large" embedded />
  </span>
</template>
<script setup>
import { computed } from 'vue'
import RollModeBadge from './RollModeBadge.vue'
const props = defineProps({ mode: { type: String, default: 'normal' }, source: String, cancelled: Boolean, primary: Boolean, compact: Boolean, active: Boolean, stacked: Boolean })
const hasMode = computed(() => !props.cancelled && ['advantage', 'disadvantage'].includes(props.mode))
</script>
<style scoped>
.stat-roll-value {--stat-roll-height:var(--layout-sheet-value-height);--roll-mode-fit-die-size:calc(var(--stat-roll-height) - var(--type-roll-mode-caption-line-height));--roll-mode-caption-size:var(--type-roll-mode-caption-size);--roll-mode-caption-line-height:var(--type-roll-mode-caption-line-height);position:relative;isolation:isolate;display:inline-flex;align-items:center;gap:var(--spacing-compact);flex:none;min-width:0;min-height:var(--stat-roll-height)}
.stat-roll-value--compact {--stat-roll-height:var(--layout-sheet-value-compact-height)}
.stat-roll-value--primary {--stat-roll-height:var(--type-sheet-stat-size)}
.stat-roll-value--primary.stat-roll-value--compact {--stat-roll-height:var(--type-sheet-stat-compact-size)}
.stat-roll-value--stacked {--roll-mode-fit-die-size:var(--layout-sheet-stat-mode-die);padding-bottom:var(--stat-roll-badge-space);}
.stat-roll-value--stacked > .roll-badge {position:absolute;inset-inline-start:0;bottom:0;}
.stat-roll-value--mode::before {content:"";position:absolute;inset:0;z-index:-1;border-radius:var(--radius-input);background:color-mix(in srgb,var(--stat-roll-mode-color) 12%,transparent)}
.stat-roll-value__number {display:inline-flex;align-items:center;flex:none;min-width:0;border-radius:var(--radius-input);background:var(--surface-raised);box-shadow:var(--stat-roll-focus-ring,none);transition:background-color var(--motion-feedback),box-shadow var(--motion-feedback)}
.stat-roll-value--primary .stat-roll-value__number {background:transparent}
.stat-roll-value:not(.stat-roll-value--mode):hover .stat-roll-value__number {background:var(--surface-active)}
.stat-roll-value--active .stat-roll-value__number {background:color-mix(in srgb,var(--accent) 16%,var(--surface-raised));box-shadow:0 0 0 var(--layout-border) var(--accent-soft)}
.stat-roll-value--mode .stat-roll-value__number {background:transparent}
.stat-roll-value--mode:hover::before {background:color-mix(in srgb,var(--stat-roll-mode-color) 18%,transparent)}
@media (prefers-reduced-motion: reduce) {.stat-roll-value__number {transition:none}}
</style>
