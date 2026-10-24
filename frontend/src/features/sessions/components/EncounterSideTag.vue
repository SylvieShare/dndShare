<template><span v-if="SIDE_LABEL[side]" class="enc-badge" :style="{ color: SIDE_COLOR[side] }">{{ SIDE_LABEL[side] }}</span></template>
<script setup>
import { SIDE_LABEL, SIDE_COLOR } from '../lib/encounterHelpers'
defineProps({ side: String })
</script>
<style scoped>
.enc-badge { flex: none; font-size: 9px; font-weight: 700; border-radius: 4px; padding: 2px 5px; border: 1px solid color-mix(in srgb, currentColor 25%, transparent); background: color-mix(in srgb, currentColor 10%, transparent); }
</style>
