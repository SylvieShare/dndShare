<template>
  <span class="stat-roll-value" :class="{ 'stat-roll-value--mode': hasMode, 'stat-roll-value--primary': primary, 'stat-roll-value--active': active }"
    :style="{ '--stat-roll-mode-color': mode === 'advantage' ? 'var(--success)' : 'var(--danger)' }">
    <RollModeBadge v-if="!primary" :mode="mode" :source="source" :cancelled="cancelled" embedded />
    <span class="stat-roll-value__number" data-stat-roll-number><slot /></span>
    <RollModeBadge v-if="primary" :mode="mode" :source="source" :cancelled="cancelled" variant="large" embedded />
  </span>
</template>
<script setup>
import { computed } from 'vue'
import RollModeBadge from './RollModeBadge.vue'
const props = defineProps({ mode: { type: String, default: 'normal' }, source: String, cancelled: Boolean, primary: Boolean, active: Boolean })
const hasMode = computed(() => !props.cancelled && ['advantage', 'disadvantage'].includes(props.mode))
</script>
<style scoped>
.stat-roll-value {position:relative;isolation:isolate;display:inline-flex;align-items:center;gap:var(--spacing-compact);flex:none;min-width:0;min-height:calc(var(--layout-roll-mode-badge-die) + var(--type-roll-mode-caption-line-height))}
.stat-roll-value--mode::before {content:"";position:absolute;inset:calc(var(--spacing-compact) / -2) calc(-1 * var(--spacing-xs));z-index:-1;border-radius:calc(var(--radius-input) + var(--spacing-xs));background:color-mix(in srgb,var(--stat-roll-mode-color) 12%,transparent)}
.stat-roll-value__number {display:inline-flex;align-items:center;flex:none;min-width:0;border-radius:var(--radius-input);background:var(--surface-raised);box-shadow:var(--stat-roll-focus-ring,none);transition:background-color var(--motion-feedback),box-shadow var(--motion-feedback)}
.stat-roll-value--primary {min-height:calc(var(--layout-roll-mode-menu-die) + var(--type-context-line-height))}
.stat-roll-value--primary .stat-roll-value__number {background:transparent}
.stat-roll-value--primary.stat-roll-value--mode .stat-roll-value__number {background:var(--surface-raised)}
.stat-roll-value:hover .stat-roll-value__number {background:var(--surface-active)}
.stat-roll-value--active .stat-roll-value__number {background:color-mix(in srgb,var(--accent) 16%,var(--surface-raised));box-shadow:0 0 0 var(--layout-border) var(--accent-soft)}
@media (prefers-reduced-motion: reduce) {.stat-roll-value__number {transition:none}}
</style>
