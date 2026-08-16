<template>
  <aside class="canvas-hotkeys" aria-label="Горячие клавиши холста">
    <kbd>{{ modifier }} + клик</kbd><span>выбрать узел</span>
    <kbd>{{ modifier }} + протянуть</kbd><span>выделить рамкой</span>
    <kbd>{{ modifier }} + A</kbd><span>выбрать всё</span>
    <kbd>Двойной клик</kbd><span>открыть вложенный холст</span>
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
  bottom: 42px;
  left: calc(var(--chapter-safe-left, 0px) + 8px);
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
  animation: canvas-hotkeys-in .16s cubic-bezier(.22, 1, .36, 1) both;
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
@media (prefers-reduced-motion: reduce) {
  .canvas-hotkeys { animation: none; }
}
@keyframes canvas-hotkeys-in {
  from { opacity: 0; transform: translateY(3px); }
}
</style>
