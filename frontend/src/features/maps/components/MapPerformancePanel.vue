<template>
  <MapModelMemory :usage="editor.modelMemory" />
  <MapPerformance :editor="editor" />
</template>
<script setup>
import MapModelMemory from "./MapModelMemory.vue";
import MapPerformance from "./MapPerformance.vue";
defineProps({ editor: { type: Object, required: true } });
</script>
