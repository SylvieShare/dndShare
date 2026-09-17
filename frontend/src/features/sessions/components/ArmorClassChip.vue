<template><span class="armor-class-chip" :aria-label="`Класс доспеха: ${value ?? '—'}`" title="Класс доспеха"><strong>{{ value ?? '—' }}</strong><Shield :size="17" aria-hidden="true" /></span></template>
<script setup>
import { Shield } from '@lucide/vue'
defineProps({ value: { type: [Number, String], default: null } })
</script>
<style scoped>
.armor-class-chip { display: inline-flex; flex: none; align-items: center; gap: 5px; padding: 5px 7px; border: 1px solid var(--border); border-radius: var(--r-sm); background: var(--surface-raised); }
.armor-class-chip strong { font-size: 19px; font-weight: 800; line-height: 1; color: var(--text-1); font-variant-numeric: tabular-nums; }
.armor-class-chip svg { color: var(--info); }
</style>
