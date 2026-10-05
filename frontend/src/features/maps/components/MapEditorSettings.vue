<template>
  <section class="map-editor-settings" aria-label="Настройки редактора">
    <MapEditorInspector :editor="editor" @tool="emit('tool', $event)" />
  </section>
</template>
<script setup>
import MapEditorInspector from "./MapEditorInspector.vue";
defineProps({ editor: Object });
const emit = defineEmits(["tool"]);
</script>
<style scoped>
.map-editor-settings {
  padding: 24px;
  min-height: 0;
  overflow: auto;
  flex: 1;
}
</style>
