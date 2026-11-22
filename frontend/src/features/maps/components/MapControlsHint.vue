<template><WorkspaceControlsHint class="map-controls-hint" :lines="lines" label="Управление картой" commands-label="Команды управления картой" /></template>
<script setup>
import WorkspaceControlsHint from '@/shared/ui/WorkspaceControlsHint.vue'
defineProps({ lines: { type: Array, required: true } })
</script>
<style scoped>
.map-controls-hint.workspace-controls-hint {
  position: static;
  max-width: min(420px, 100%);
  max-height: min(50dvh, 320px);
  pointer-events: auto;
}
</style>
