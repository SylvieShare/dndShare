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
  /* Canvas safe area includes 28px after the rail; tabs need an 8px gap. */
  padding: 10px calc(var(--chapter-safe-right, 0px) + 10px) 10px max(8px, calc(var(--chapter-safe-left, 28px) - 20px));
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
  .session-tab-workspace { padding: 8px; }
}
</style>
