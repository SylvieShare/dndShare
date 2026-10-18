<template>
  <WorkspaceCanvasControls class="map-canvas-controls" @zoom="emit('zoom', $event)" @fit="emit('fit')">
    <ActionButton variant="secondary" icon-only :title="topView ? 'Изометрический вид' : 'Вид сверху'" @click="emit('toggle-view')"><Box :size="16" /></ActionButton>
  </WorkspaceCanvasControls>
</template>
<script setup>
import { ActionButton } from '@sylvieshare/share-ui'
import { Box } from '@lucide/vue'
import WorkspaceCanvasControls from '@/shared/ui/WorkspaceCanvasControls.vue'
defineProps({ topView: Boolean })
const emit = defineEmits(['zoom', 'fit', 'toggle-view'])
</script>
