<template>
  <div
    ref="anchor"
    class="map-model-group"
    :data-variant-code="group.code"
    :style="motion.placeholder.value"
    @pointerenter="enter"
    @pointerleave="motion.scheduleClose"
  >
    <Teleport to="body" :disabled="!motion.active.value">
      <BaseTile
        ref="panel"
        class="map-variants-panel"
        :class="{ 'map-variants-panel--expanded': motion.expanded.value }"
        :style="motion.fixed.value"
        role="group"
        :aria-label="`Варианты ${label}`"
        :aria-expanded="motion.expanded.value"
        @pointerenter="enter"
        @pointerleave="motion.scheduleClose"
        @focusin="enter"
        @keydown.right.prevent="focusNext(1)"
        @keydown.left.prevent="focusNext(-1)"
      >
        <MapModelLightBadge
          v-if="
            !motion.expanded.value &&
            !primary.behaviour?.defaultLights?.length &&
            familyHasLight
          "
          class="map-family-light"
          :count="1"
        />
        <div class="map-variant-row">
          <MapTileCard
            :key="primary.id"
            class="map-variant-primary"
            :data-variant-id="primary.id"
            :model="primary"
            :selected="selectedId === primary.id"
            :draggable="draggable"
            :show-identifiers="showIdentifiers"
            @model="choose"
            @drag-tile="drag"
          />
          <div class="map-variant-secondary">
            <MapTileCard
              v-for="model in secondary"
              :key="model.id"
              :data-variant-id="model.id"
              :model="model"
              :selected="selectedId === model.id"
              :draggable="draggable"
              :show-identifiers="showIdentifiers"
              @model="choose"
              @drag-tile="drag"
            />
          </div>
        </div>
      </BaseTile>
    </Teleport>
  </div>
</template>
<script setup>
import { computed, nextTick, ref, watch } from "vue";
import { BaseTile } from "@sylvieshare/share-ui";
import MapTileCard from "./MapTileCard.vue";
import MapModelLightBadge from "./MapModelLightBadge.vue";
import { useVariantExpansion } from "../composables/useVariantExpansion";
const props = defineProps({
  group: Object,
  selectedId: String,
  draggable: Boolean,
  showIdentifiers: Boolean,
});
const emit = defineEmits(["model", "drag-tile"]);
const anchor = ref(null),
  panel = ref(null),
  frozen = ref("");
const motion = useVariantExpansion(
  anchor,
  panel,
  () => props.group.models.length,
);
const primary = computed(
  () =>
    props.group.models.find(
      (m) => m.id === (motion.active.value ? frozen.value : props.selectedId),
    ) || props.group.models[0],
);
const familyHasLight = computed(() =>
  props.group.models.some((model) => model.behaviour?.defaultLights?.length),
);
const secondary = computed(() =>
  props.group.models.filter((m) => m.id !== primary.value.id),
);
const label = computed(() =>
  props.showIdentifiers
    ? props.group.code
    : primary.value.name.replace(/\s+\d+$/, ""),
);
function enter(event) {
  if (!motion.active.value) frozen.value = primary.value.id;
  motion.enter(event);
}
function choose(id, event) {
  motion.dismiss();
  emit("model", id, event);
}
function drag(id, event) {
  motion.drag();
  emit("drag-tile", id, event);
}
async function focusNext(step) {
  if (!motion.active.value) frozen.value = primary.value.id;
  motion.open();
  await nextTick();
  const buttons = [...panel.value.$el.querySelectorAll('[role="button"]')];
  buttons[
    (buttons.indexOf(document.activeElement) + step + buttons.length) %
      buttons.length
  ]?.focus();
}
watch(
  () => motion.active.value,
  (active) => {
    if (!active) frozen.value = "";
  },
);
</script>
<style scoped>
.map-family-light {
  position: absolute;
  top: 6px;
  right: 34px;
  z-index: 1;
}
.map-model-group {
  min-width: 0;
}
.map-variants-panel {
  --surface: var(--map-model-preview-bg);
  padding: 0;
  overflow: hidden;
  box-shadow: none;
}
.map-variant-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 24px;
  gap: 4px;
  align-items: start;
}
.map-variant-secondary {
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-height: 110px;
  overflow: hidden;
}
.map-variants-panel:not(.map-variants-panel--expanded)
  .map-variant-secondary
  > :deep(.map-model-card) {
  padding: 0;
  width: 22px;
  height: 22px;
  overflow: hidden;
  border-radius: 4px;
}
.map-variants-panel:not(.map-variants-panel--expanded)
  .map-variant-secondary
  :deep(img) {
  width: 22px;
  height: 22px;
  border-radius: 3px;
}
.map-variants-panel:not(.map-variants-panel--expanded)
  .map-variant-secondary
  :deep(.map-model-name),
.map-variants-panel:not(.map-variants-panel--expanded)
  .map-variant-secondary
  :deep(small),
.map-variants-panel:not(.map-variants-panel--expanded)
  .map-variant-secondary
  :deep(.map-card-light) {
  display: none;
}
.map-variants-panel--expanded {
  padding: 8px;
  box-shadow:
    0 12px 32px color-mix(in srgb, var(--bg) 65%, transparent),
    inset 0 0 0 1px var(--border-strong);
}
.map-variants-panel--expanded .map-variant-row {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  overscroll-behavior: contain;
  align-items: stretch;
}
.map-variants-panel--expanded .map-variant-secondary {
  display: contents;
}
.map-variants-panel :deep(.map-model-card) {
  transform-origin: top left;
}
.map-variants-panel--expanded :deep(.map-model-card) {
  flex: 0 0 120px;
  width: 120px;
  transform-origin: top left;
}
</style>
