<template>
  <svg v-if="choice === 'rock'" :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="m5 5 8-2 6 5 3 8-6 5-11-2-3-7Z" />
    <path d="m5 5 4 6-4 8m4-8 10-3M9 11l7 10" />
  </svg>
  <Scissors v-else-if="choice === 'scissors'" :size="size" :stroke-width="1.7" aria-hidden="true" />
  <File v-else-if="choice === 'paper'" :size="size" :stroke-width="1.7" aria-hidden="true" />
</template>
<script setup>
import { File, Scissors } from '@lucide/vue'
defineProps({ choice: String, size: { type: Number, default: 64 } })
</script>
