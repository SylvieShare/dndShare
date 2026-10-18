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
  background-color: color-mix(in srgb, var(--surface) 52%, transparent);
  background-image: linear-gradient(150deg, color-mix(in srgb, var(--text-on-accent) 6%, transparent), transparent 60%);
  backdrop-filter: blur(24px) saturate(1.2);
  -webkit-backdrop-filter: blur(24px) saturate(1.2);
  box-shadow: 0 8px 24px color-mix(in srgb, var(--bg) 28%, transparent), inset 0 1px 0 color-mix(in srgb, var(--text-on-accent) 8%, transparent);
  transition: background-color .18s ease, border-color .18s ease;
  animation: workspace-tools-enter .18s ease backwards;
  max-height: calc(100% - 28px);
  overflow-y: auto;
  scrollbar-width: thin;
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .workspace-tools-rail { background-color: color-mix(in srgb, var(--surface) 94%, transparent); }
}
@keyframes workspace-tools-enter {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .workspace-tools-rail { transition: none; animation: none; }
}
</style>
