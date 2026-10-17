<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path
      d="m9 14 11 3-6 4-10-4Z"
      fill="currentColor"
      fill-opacity=".3"
      stroke="none"
    />
    <path d="m5 7 5-3 5 3-5 3Z" fill="currentColor" fill-opacity=".12" />
    <path d="m5 7 5 3v7l-5-3Z" fill="currentColor" fill-opacity=".32" />
    <path d="m10 10 5-3v7l-5 3Z" fill="currentColor" fill-opacity=".07" />
    <path d="m5 7 5-3 5 3v7l-5 3-5-3ZM5 7l5 3 5-3M10 10v7M15 15l5 2-6 4-5-2" />
  </svg>
</template>
<script setup>
defineProps({ size: { type: Number, default: 24 } });
</script>
