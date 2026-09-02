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
  padding: 10px 10px 10px max(8px, calc(var(--chapter-safe-left, 28px) - 20px));
  background-color: var(--app-canvas-bg);
  background-image: var(--app-canvas-pattern);
  background-size: var(--app-canvas-dot-size) var(--app-canvas-dot-size);
}
.session-chronicle-surface {
  width: min(980px, 100%);
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  margin: 0 auto;
  border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
  border-radius: 13px;
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  box-shadow: 0 10px 30px color-mix(in srgb, var(--bg) 32%, transparent);
  backdrop-filter: blur(14px) saturate(1.08);
  -webkit-backdrop-filter: blur(14px) saturate(1.08);
}
@media (max-width: 760px) { .session-chronicle-workspace { padding: 8px; } }
</style>
