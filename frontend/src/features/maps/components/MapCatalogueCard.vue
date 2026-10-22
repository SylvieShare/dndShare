<template>
  <BaseTile
    class="map-model-card"
    interactive
    :framed="selected"
    :tint="selected"
    role="button"
    tabindex="0"
    :aria-label="item.name"
    :title="
      showIdentifiers ? `${item.sourceCode} · ${item.sourceName}` : item.name
    "
    @pointerdown="
      draggable && !isSelectableText($event) && emit('drag', item.id, $event)
    "
    @click="!draggable && !hasSelectedText() && emit('select', item.id, $event)"
    @dragstart="!isSelectableText($event) && $event.preventDefault()"
    @keydown.enter.prevent.stop="emit('select', item.id, $event)"
    @keydown.space.prevent.stop="emit('select', item.id, $event)"
  >
    <img
      :src="item.previewUrl"
      alt=""
      width="112"
      height="112"
      loading="lazy"
      draggable="false"
    />
    <span class="map-model-name">{{ item.name }}</span
    ><small v-if="showIdentifiers">{{ item.definitionId }}</small>
    <MapModelLightBadge
      class="map-card-light"
      :count="item.behaviour?.defaultLights?.length || 0"
    />
    <small v-if="item.width > 1 || item.height > 1"
      >{{ item.width }} × {{ item.height }} клетки</small
    >
    <small v-if="item.supportSlots?.length"
      >Пазов: {{ item.supportSlots.length }}</small
    >
  </BaseTile>
</template>
<script setup>
import { BaseTile } from "@sylvieshare/share-ui";
import { hasSelectedText, isSelectableText } from "../lib/textSelection";
import MapModelLightBadge from "./MapModelLightBadge.vue";
defineProps({
  item: Object,
  selected: Boolean,
  draggable: Boolean,
  showIdentifiers: Boolean,
});
const emit = defineEmits(["select", "drag"]);
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
  user-select: auto;
}
.map-model-card img {
  width: 100%;
  height: 105px;
  object-fit: contain;
  border-radius: 6px;
  pointer-events: none;
}
.map-card-light {
  position: absolute;
  right: 6px;
  top: 6px;
}
.map-model-name {
  user-select: text;
  white-space: normal;
  font-size: 12px;
  line-height: 1.3;
}
.map-model-card small {
  user-select: text;
  font-family: var(--font-mono);
  font-size: 10px;
  opacity: 0.7;
}
</style>
