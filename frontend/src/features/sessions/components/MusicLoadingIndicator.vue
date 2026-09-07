<template>
  <LoaderCircle class="music-loading-indicator" :size="size" aria-hidden="true" />
</template>

<script setup>
import { LoaderCircle } from '@lucide/vue'
defineProps({ size: { type: Number, default: 14 } })
</script>

<style scoped>
.music-loading-indicator { flex-shrink: 0; animation: music-loading-spin 1s linear infinite; }
@keyframes music-loading-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  .music-loading-indicator { animation: none; }
}
</style>
