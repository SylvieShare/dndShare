<template>
  <MapTileCard
    v-if="group.models.length === 1"
    :model="primary"
    :selected="selectedId === primary.id"
    :draggable="draggable"
    @model="(id, event) => emit('model', id, event)"
    @drag-tile="(id, event) => emit('drag-tile', id, event)"
  />
  <div
    v-else
    ref="anchor"
    class="map-model-group"
    @pointerenter="show"
    @pointerleave="scheduleClose"
    @focusin="show"
  >
    <BaseTile
      class="map-group-card"
      interactive
      :framed="selected"
      :tint="selected"
      role="button"
      tabindex="0"
      :aria-label="`Группа ${group.code}`"
      :aria-expanded="open"
      @click="show"
      @keydown.enter.prevent="focusVariants"
      @keydown.space.prevent="focusVariants"
      @keydown.right.prevent="focusVariants"
    >
      <div class="map-group-images">
        <img
          :src="primary.previewUrl"
          class="map-group-primary"
          alt=""
          draggable="false"
        />
        <div class="map-group-thumbnails" aria-hidden="true">
          <img
            v-for="model in group.models"
            :key="model.id"
            :src="model.previewUrl"
            :title="`${model.definitionId} · ${model.name}`"
            alt=""
            draggable="false"
          />
        </div>
      </div>
      <strong class="map-group-name">{{
        primary.name.replace(/\s+\d+$/, "")
      }}</strong>
      <div class="map-group-meta">
        <small>{{ group.code }}</small
        ><span>×{{ group.models.length }}</span
        ><MapModelLightBadge :count="lights" />
      </div>
    </BaseTile>
    <BasePopover
      v-model:open="open"
      :anchor="anchor"
      placement="right-start"
      :offset="4"
      :min-width="350"
      :z-index="3400"
      role="region"
      :aria-label="`Варианты ${group.code}`"
      related
    >
      <div
        ref="variants"
        class="map-group-variants"
        @pointerenter="cancelClose"
        @pointerleave="scheduleClose"
        @focusin="cancelClose"
        @keydown.esc.stop="close"
      >
        <header>
          <strong>{{ group.code }}</strong
          ><span>{{ group.models.length }} вариантов</span>
        </header>
        <div class="map-group-variant-grid">
          <MapTileCard
            v-for="model in group.models"
            :key="model.id"
            :model="model"
            :selected="selectedId === model.id"
            :draggable="draggable"
            @model="(id, event) => choose(id, event)"
            @drag-tile="(id, event) => drag(id, event)"
          />
        </div>
      </div>
    </BasePopover>
  </div>
</template>
<script setup>
import { computed, nextTick, onBeforeUnmount, ref } from "vue";
import { BaseTile, BasePopover } from "@sylvieshare/share-ui";
import MapTileCard from "./MapTileCard.vue";
import MapModelLightBadge from "./MapModelLightBadge.vue";
const props = defineProps({
  group: Object,
  selectedId: String,
  draggable: Boolean,
});
const emit = defineEmits(["model", "drag-tile"]);
const anchor = ref(null),
  variants = ref(null),
  open = ref(false);
let timer,
  dragging = false;
const primary = computed(
  () =>
    props.group.models.find((m) => m.id === props.selectedId) ||
    props.group.models[0],
);
const selected = computed(() =>
  props.group.models.some((m) => m.id === props.selectedId),
);
const lights = computed(() =>
  props.group.models.reduce(
    (n, m) => n + (m.behaviour?.defaultLights?.length || 0),
    0,
  ),
);
function cancelClose() {
  clearTimeout(timer);
}
function show() {
  cancelClose();
  open.value = true;
}
function scheduleClose() {
  cancelClose();
  if (!dragging) timer = setTimeout(close, 180);
}
function close() {
  cancelClose();
  open.value = false;
}
async function focusVariants() {
  show();
  await nextTick();
  variants.value
    ?.querySelector('[role="button"]')
    ?.focus({ preventScroll: true });
}
function choose(id, event) {
  emit("model", id, event);
  close();
}
function finishDrag() {
  dragging = false;
  window.removeEventListener("pointerup", finishDrag);
  window.removeEventListener("pointercancel", finishDrag);
  scheduleClose();
}
function drag(id, event) {
  dragging = true;
  cancelClose();
  window.addEventListener("pointerup", finishDrag);
  window.addEventListener("pointercancel", finishDrag);
  emit("drag-tile", id, event);
}
onBeforeUnmount(() => {
  cancelClose();
  window.removeEventListener("pointerup", finishDrag);
  window.removeEventListener("pointercancel", finishDrag);
});
</script>
<style scoped>
.map-model-group {
  min-width: 0;
}
.map-group-card {
  --surface: var(--map-model-preview-bg);
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 6px;
  height: 100%;
}
.map-group-images {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 24px;
  gap: 4px;
  height: 105px;
}
.map-group-primary {
  width: 100%;
  height: 94px;
  object-fit: contain;
  pointer-events: none;
}
.map-group-thumbnails {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: auto;
}
.map-group-thumbnails img {
  width: 22px;
  height: 22px;
  object-fit: contain;
  flex: none;
}
.map-group-name {
  font-size: 12px;
  font-weight: 500;
}
.map-group-meta {
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: 10px;
  color: var(--text-muted);
}
.map-group-meta small {
  overflow-wrap: anywhere;
  flex: 1;
}
.map-group-variants {
  max-height: min(70vh, 560px);
  overflow: auto;
  width: 350px;
}
.map-group-variants header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
  font-size: 12px;
}
.map-group-variant-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
</style>
