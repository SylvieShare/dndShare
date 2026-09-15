<template>
  <div class="application-notification">
    <strong class="application-notification-title">{{ entry.title }}</strong>
    <ApplicationSummary :data="entry.data.result" result />
  </div>
</template>
<script setup>
import ApplicationSummary from '@/features/character-editor/components/ApplicationSummary.vue'
defineProps({ entry: { type: Object, required: true } })
</script>
<style scoped>
.application-notification { display: grid; gap: 12px; min-width: 0; overflow-wrap: anywhere; }
.application-notification-title { padding-right: 22px; color: var(--text-1); font-size: 14px; }
</style>
