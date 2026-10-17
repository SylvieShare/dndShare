<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="m9 13 12 4-6 4-11-5Z" fill="currentColor" fill-opacity=".28" />
    <path d="m4 6 5-3 5 3v7l-5 3-5-3Z" />
    <path d="m4 6 5 3 5-3M9 9v7" />
    <path v-if="off" d="M3 3 21 21" stroke-width="2.2" />
  </svg>
</template>
<script setup>
defineProps({ off: Boolean, size: { type: Number, default: 22 } });
</script>
