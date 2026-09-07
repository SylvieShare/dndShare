<template>
  <section class="session-chronicle-workspace" aria-label="Хроника сессии">
    <div class="session-chronicle-surface">
      <SessionEventsPanel :live-status="liveStatus" workspace />
    </div>
  </section>
</template>

<script setup>
import SessionEventsPanel from '@/features/sessions/components/SessionEventsPanel.vue'

defineProps({ liveStatus: { type: String, default: 'idle' } })
</script>

<style scoped>
.session-chronicle-workspace {
  position: absolute;
  z-index: 5;
  inset: 0;
  min-width: 0;
  min-height: 0;
}
.session-chronicle-surface {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
  border-radius: 13px;
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  box-shadow: 0 10px 30px color-mix(in srgb, var(--bg) 32%, transparent);
  backdrop-filter: blur(14px) saturate(1.08);
  -webkit-backdrop-filter: blur(14px) saturate(1.08);
}
</style>
