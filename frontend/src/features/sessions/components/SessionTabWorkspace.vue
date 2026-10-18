<template>
  <div class="session-tab-workspace" :class="`session-tab-workspace--${mode}`">
    <div class="session-tab-workspace-content">
      <slot />
    </div>
  </div>
</template>

<script setup>
defineProps({ mode: { type: String, default: 'column', validator: value => ['full', 'column'].includes(value) } })
</script>

<style scoped>
.session-tab-workspace {
  position: absolute;
  z-index: 5;
  inset: 0;
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
  /* The canvas safe area already includes 28px after the participant rail. */
  padding: 28px calc(var(--chapter-safe-right, 0px) + 28px) 28px max(28px, var(--chapter-safe-left, 28px));
  background-color: var(--app-canvas-bg);
  background-image: var(--app-canvas-pattern);
  background-size: var(--app-canvas-dot-size) var(--app-canvas-dot-size);
}

.session-tab-workspace-content {
  position: relative;
  width: 100%;
  max-width: 1440px;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.session-tab-workspace--full { padding: 0; background: transparent; }
.session-tab-workspace--full .session-tab-workspace-content { max-width: none; }

@media (max-width: 760px) {
  .session-tab-workspace--column { padding: 16px calc(var(--chapter-safe-right, 0px) + 12px) 16px 16px; }
}
</style>
