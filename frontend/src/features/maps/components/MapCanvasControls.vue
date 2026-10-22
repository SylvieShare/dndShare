<template>
  <WorkspaceCanvasControls
    class="map-canvas-controls"
    @zoom="emit('zoom', $event)"
    @fit="emit('fit')"
  >
    <ActionButton
      v-if="!flat"
      variant="secondary"
      icon-only
      :title="topView ? 'Изометрический вид' : 'Вид сверху'"
      @click="emit('toggle-view')"
      ><Box :size="16"
    /></ActionButton>
  </WorkspaceCanvasControls>
</template>
<script setup>
import { ActionButton } from "@sylvieshare/share-ui";
import { Box } from "@lucide/vue";
import WorkspaceCanvasControls from "@/shared/ui/WorkspaceCanvasControls.vue";
defineProps({ topView: Boolean, flat: Boolean });
const emit = defineEmits(["zoom", "fit", "toggle-view"]);
</script>
