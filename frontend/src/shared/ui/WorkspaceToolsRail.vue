<template>
  <aside class="workspace-tools-rail"><slot /></aside>
</template>
<style scoped>
.workspace-tools-rail {
  position: absolute;
  z-index: 16;
  top: 14px;
  right: var(--workspace-tools-offset, 10px);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: var(--workspace-tools-width, 84px);
  box-sizing: border-box;
  padding: 8px 6px;
  border: 1px solid color-mix(in srgb, var(--border-strong) 70%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--surface) 78%, transparent);
  backdrop-filter: blur(14px) saturate(1.08);
  -webkit-backdrop-filter: blur(14px) saturate(1.08);
  box-shadow: var(--shadow-sm);
  transition: background-color .18s ease, border-color .18s ease;
  animation: workspace-tools-enter .18s ease both;
  max-height: calc(100% - 28px);
  overflow-y: auto;
  scrollbar-width: thin;
}
@keyframes workspace-tools-enter {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .workspace-tools-rail { transition: none; animation: none; }
}
</style>
