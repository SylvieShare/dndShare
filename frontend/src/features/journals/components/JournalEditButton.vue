<template><button class="diary-pencil" type="button" :disabled="disabled" :title="label" :aria-label="label" @click="$emit('click', $event)"><Pencil :size="14" /></button></template>
<script setup>
import { Pencil } from '@lucide/vue'
defineProps({ label: { type: String, required: true }, disabled: Boolean })
defineEmits(['click'])
</script>
<style scoped>
.diary-pencil { display: grid; flex: none; place-items: center; width: 28px; height: 28px; padding: 0; border: 0; border-radius: 7px; background: transparent; color: var(--text-muted); opacity: .38; cursor: pointer; transition: opacity .15s, color .15s; }
.diary-pencil:hover, .diary-pencil:focus-visible { opacity: 1; color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, transparent); }
.diary-pencil:disabled { opacity: .18; cursor: default; }
@media (max-width: 720px) { .diary-pencil { opacity: .65; } }
@media (prefers-reduced-motion: reduce) { .diary-pencil { transition: none; } }
</style>
