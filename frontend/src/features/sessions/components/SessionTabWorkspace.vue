<template>
  <div class="session-tab-workspace">
    <div class="session-tab-workspace-content">
      <slot />
    </div>
  </div>
</template>

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

@media (max-width: 760px) {
  .session-tab-workspace { padding: 16px; }
}
</style>
