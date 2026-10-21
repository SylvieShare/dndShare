<template><WorkspaceControlsHint class="canvas-hotkeys" :lines="lines" label="Управление сюжетом" commands-label="Команды управления сюжетом" /></template>
<script setup>
import WorkspaceControlsHint from '@/shared/ui/WorkspaceControlsHint.vue'
const mac = /Mac|iPhone|iPad/.test(globalThis.navigator?.platform || '')
const modifier = mac ? '⌘' : 'Ctrl', deleteKey = mac ? '⌫' : 'Del'
const lines = [
  'Перенос фона — перемещение холста',
  'Колесо · + / − — масштаб',
  `${modifier} + клик — выбрать узел`,
  `${modifier} + протянуть — выделить рамкой`,
  `${modifier} + A — выбрать всё`,
  'Двойной клик — открыть вложенный холст',
  `${deleteKey} — удалить выбранное`,
  'Esc — снять выделение',
]
</script>
<style scoped>
.canvas-hotkeys { z-index: 12; --workspace-hint-inset: var(--chapter-safe-left, 0px); }
</style>
