<template><p v-if="note" class="roll-outcome-note">{{ note }}</p></template>
<script setup>defineProps({ note: String })</script>
<style scoped>
.roll-outcome-note { margin: 6px 0 0; padding: 7px 10px; border-left: 2px solid var(--accent); border-radius: var(--r-sm); background: var(--surface-raised); color: var(--text-2); font-size: 12px; line-height: 1.45; }
</style>
