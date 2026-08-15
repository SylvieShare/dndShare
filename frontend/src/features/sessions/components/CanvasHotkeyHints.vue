<template>
  <aside class="canvas-hotkeys" aria-label="Горячие клавиши холста">
    <span class="canvas-hotkeys-title">Горячие клавиши</span>
    <kbd>{{ modifier }} + клик</kbd><span>выбрать узел</span>
    <kbd>{{ modifier }} + протянуть</kbd><span>выделить рамкой</span>
    <kbd>{{ modifier }} + A</kbd><span>выбрать всё</span>
    <kbd>{{ deleteKey }}</kbd><span>удалить выбранное</span>
    <kbd>Esc</kbd><span>снять выделение</span>
    <kbd>+ / −</kbd><span>изменить масштаб</span>
  </aside>
</template>

<script setup>
const mac = /Mac|iPhone|iPad/.test(globalThis.navigator?.platform || '')
const modifier = mac ? '⌘' : 'Ctrl'
const deleteKey = mac ? '⌫' : 'Del'
</script>

<style scoped>
.canvas-hotkeys {
  position: absolute;
  z-index: 12;
  bottom: 14px;
  left: 14px;
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 3px 11px;
  width: 246px;
  color: var(--text-muted);
  font-size: 10px;
  line-height: 1.35;
  pointer-events: none;
  user-select: none;
  text-shadow: 0 1px 8px var(--app-canvas-bg), 0 0 18px var(--app-canvas-bg);
}
.canvas-hotkeys-title {
  grid-column: 1 / -1;
  margin-bottom: 2px;
  color: color-mix(in srgb, var(--text-muted) 78%, transparent);
  font-size: 9px;
  font-weight: 750;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.canvas-hotkeys kbd {
  padding: 0;
  border: 0;
  background: none;
  color: var(--text-2);
  font: 700 10px/1.35 var(--font-ui);
  white-space: nowrap;
}
@media (max-width: 760px), (pointer: coarse) {
  .canvas-hotkeys { display: none; }
}
</style>
