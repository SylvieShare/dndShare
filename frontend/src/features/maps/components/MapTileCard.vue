<template>
  <BaseTile
    class="map-model-card"
    interactive
    :framed="selected"
    :tint="selected"
    role="button"
    tabindex="0"
    :aria-label="model.name"
    :title="`${model.sourceCode} · ${model.sourceName}`"
    @pointerdown="draggable && emit('drag-tile', model.id, $event)"
    @click="!draggable && emit('model', model.id, $event)"
    @dragstart.prevent
    @keydown.enter.prevent.stop="emit('model', model.id, $event)"
    @keydown.space.prevent.stop="emit('model', model.id, $event)"
  >
    <img
      :src="model.previewUrl"
      alt=""
      width="112"
      height="112"
      loading="lazy"
      draggable="false"
    />
    <span class="map-model-name">{{ model.name }}</span
    ><small>{{ model.sourceCode }}</small>
    <small v-if="model.width > 1 || model.height > 1"
      >{{ model.width }} × {{ model.height }} клетки</small
    >
    <small v-if="model.supportSlots?.length"
      >Пазов: {{ model.supportSlots.length }}</small
    >
  </BaseTile>
</template>
<script setup>
import { BaseTile } from "@sylvieshare/share-ui";
defineProps({
  model: Object,
  selected: Boolean,
  draggable: Boolean,
});
const emit = defineEmits(["model", "drag-tile"]);
</script>
<style scoped>
.map-model-card {
  --surface: var(--map-model-preview-bg);
  display: flex;
  height: auto;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
  padding: 6px;
  cursor: pointer;
  touch-action: none;
  user-select: none;
}
.map-model-card img {
  width: 100%;
  height: 105px;
  object-fit: contain;
  border-radius: 6px;
  pointer-events: none;
}
.map-model-name {
  white-space: normal;
  font-size: 12px;
  line-height: 1.3;
}
.map-model-card small {
  font-family: var(--font-mono);
  font-size: 10px;
  opacity: 0.7;
}
</style>
