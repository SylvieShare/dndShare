<template><WorkspaceControlsHint class="map-controls-hint" :lines="lines" label="Управление картой" commands-label="Команды управления картой" /></template>
<script setup>
import WorkspaceControlsHint from '@/shared/ui/WorkspaceControlsHint.vue'
defineProps({ lines: { type: Array, required: true } })
</script>
<style scoped>
.map-controls-hint { --workspace-hint-inset: var(--map-overlay-left, 0px); }
</style>
