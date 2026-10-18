<template>
  <Transition
    name="map-focus"
    appear
    @before-leave="disableLeaving"
    @before-enter="enableEntering"
  >
    <aside
      ref="element"
      v-if="customFocus || area || entries.length"
      class="map-selection-panel"
      aria-label="Выбранные элементы"
    >
      <BaseTile class="map-selection-content">
        <Transition
          name="map-focus-swap"
          mode="out-in"
          @before-leave="holdHeight"
          @enter="resizeFrame"
        >
          <div :key="focusKey" class="map-selection-view">
            <slot v-if="customFocus" name="focus" />
            <MapAreaFocus
              v-else-if="area"
              :editor="editor"
              :area="area"
              @focus="emit('focus', $event)"
            />
            <MapSelectedEntity
              v-else-if="entries.length === 1"
              :entry="single"
              :editor="editor"
            >
              <template v-if="single.kind === 'light'" #after-preview
                ><MapLightActions :editor="editor" :light="single.item" primary
              /></template>
              <MapLightFields
                v-if="single.kind === 'light'"
                :editor="editor"
                :light="single.item"
                @bind="emit('bind', $event)"
                @focus="emit('focus', [$event])"
              />
              <MapSelectionActions
                v-if="single.kind === 'light'"
                :editor="editor"
                :entry="single"
                @area="emit('area', $event)"
              />
              <template v-else>
                <MapSelectionActions
                  :editor="editor"
                  :entry="single"
                  @area="emit('area', $event)"
                />
                <ToggleSwitch
                  v-if="
                    single.kind === 'object' &&
                    !single.item.modelId &&
                    interactive(single.item.kind)
                  "
                  :model-value="
                    editor.draft.state?.objects[single.id] ?? single.item.open
                  "
                  label="Открыто"
                  @update:model-value="
                    editor.change((m) => {
                      if (m.state) m.state.objects[single.id] = $event;
                      else
                        m.document.objects.find(
                          (o) => o.id === single.id,
                        ).open = $event;
                    })
                  "
                />
                <MapModelTransitions :editor="editor" :entry="single" />
                <MapModelLights :editor="editor" :entry="single" />
              </template>
            </MapSelectedEntity>
            <MapFocusContent v-else>
              <template #heading
                ><MapEntityHeading
                  :entry="{
                    kind: 'group',
                    name: `Выбрано: ${entries.length}`,
                  }"
              /></template>
              <div class="map-selection-summary">
                <span
                  v-if="editor.selectedTiles.length"
                  role="status"
                  aria-label="Выбрано плиток"
                  >Выбрано: {{ editor.selectedTiles.length }}</span
                >
                <span
                  v-if="editor.selectedObjects.length"
                  role="status"
                  aria-label="Выбрано объектов"
                  >Объектов: {{ editor.selectedObjects.length }}</span
                >
              </div>
              <div class="map-selection-list">
                <MapEntityRow
                  v-for="group in groups"
                  :key="group.groupKey"
                  :entry="group"
                  @select="emit('focus', group.members)"
                />
              </div>
              <MapSelectionActions
                :editor="editor"
                @area="emit('area', $event)"
              />
            </MapFocusContent>
          </div>
        </Transition>
      </BaseTile>
    </aside>
  </Transition>
</template>
<script setup>
import { interactive } from "../lib/mapModel";
import { computed, onBeforeUnmount, ref } from "vue";
import { BaseTile, ToggleSwitch } from "@sylvieshare/share-ui";
import { groupMapEntities, selectedMapEntities } from "../lib/editorEntities";
import MapEntityHeading from "./MapEntityHeading.vue";
import MapFocusContent from "./MapFocusContent.vue";
import MapAreaFocus from "./MapAreaFocus.vue";
import MapSelectedEntity from "./MapSelectedEntity.vue";
import MapEntityRow from "./MapEntityRow.vue";
import MapLightActions from "./MapLightActions.vue";
import MapLightFields from "./MapLightFields.vue";
import MapSelectionActions from "./MapSelectionActions.vue";
import MapModelTransitions from "./MapModelTransitions.vue";
import MapModelLights from "./MapModelLights.vue";
const element = ref(null);
defineExpose({ bounds: () => element.value?.getBoundingClientRect() });
const props = defineProps({
  editor: Object,
  customFocus: Boolean,
  customFocusKey: String,
});
const emit = defineEmits(["focus", "bind", "area"]);
const area = computed(() =>
  props.editor.draft.document.areas.find(
    (a) => a.id === props.editor.focusedArea,
  ),
);
const entries = computed(() => selectedMapEntities(props.editor));
const groups = computed(() => groupMapEntities(entries.value));
const single = computed(() => entries.value[0]);
const focusKey = computed(() =>
  props.customFocus
    ? `custom:${props.customFocusKey || "focus"}`
    : area.value
      ? `area:${area.value.id}`
      : entries.value.length === 1
        ? `${single.value.kind}:${single.value.id}`
        : "group",
);
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
let previousHeight = 0,
  heightAnimation;
function disableLeaving(node) {
  node.inert = true;
  node.setAttribute("aria-hidden", "true");
}
function enableEntering(node) {
  node.inert = false;
  node.removeAttribute("aria-hidden");
}
function holdHeight(node) {
  disableLeaving(node);
  const frame = node.parentElement;
  previousHeight = frame.getBoundingClientRect().height;
  heightAnimation?.cancel();
  if (!reduced.matches) frame.style.height = `${previousHeight}px`;
}
function resizeFrame(node) {
  const frame = node.parentElement;
  frame.style.height = "";
  if (reduced.matches || !previousHeight) return;
  const height = frame.getBoundingClientRect().height;
  heightAnimation = frame.animate(
    [{ height: `${previousHeight}px` }, { height: `${height}px` }],
    { duration: 220, easing: "cubic-bezier(.2,.7,.2,1)" },
  );
}
const finishHeight = () => heightAnimation?.finish();
reduced.addEventListener("change", finishHeight);
onBeforeUnmount(() => {
  heightAnimation?.cancel();
  reduced.removeEventListener("change", finishHeight);
});
</script>
<style scoped>
.map-selection-panel {
  position: absolute;
  z-index: 16;
  right: var(--map-focus-right, 12px);
  top: 12px;
  width: 300px;
  max-width: calc(100% - var(--map-overlay-left, 0px) - 24px);
  max-height: calc(100% - 100px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  user-select: text;
  border-radius: var(--r-lg);
}
.map-selection-view {
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.map-focus-enter-active,
.map-focus-leave-active {
  transition: opacity 180ms ease;
}
.map-focus-enter-from,
.map-focus-leave-to {
  opacity: 0;
}
.map-focus-leave-active,
.map-focus-swap-leave-active {
  pointer-events: none;
}
.map-focus-swap-enter-active {
  transition:
    opacity 180ms ease,
    transform 220ms cubic-bezier(0.2, 0.7, 0.2, 1);
}
.map-focus-swap-leave-active {
  transition:
    opacity 110ms ease,
    transform 110ms ease;
}
.map-focus-swap-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.map-focus-swap-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
@media (prefers-reduced-motion: reduce) {
  .map-focus-enter-active,
  .map-focus-leave-active,
  .map-focus-swap-enter-active,
  .map-focus-swap-leave-active {
    transition: none;
  }
}
.map-selection-panel > .map-selection-content {
  --map-panel-inset: 14px;
  padding: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.map-selection-summary {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--text-muted);
}
.map-selection-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
@media (max-width: 760px) {
  .map-selection-panel {
    width: 230px;
  }
}
</style>
