<template>
  <main
    class="map-editor-workspace"
    :class="{ 'map-editor-workspace--embedded': embedded }"
    :style="{
      '--map-overlay-left': `${Math.max(0, sidebarWidth - railWidth)}px`,
      '--map-sidebar-rail': `${railWidth}px`,
    }"
  >
    <MapEditorHeader
      v-if="!embedded"
      :editor="e"
      :admin="isAdmin && !sessionMode"
      @close="emit('close')"
      @reference="openReference"
    />
    <AppModalFrame
      v-if="referenceOpen && isAdmin"
      title="Справочник тайлов"
      close-label="Закрыть справочник тайлов"
      :width="1400"
      :padded="false"
      :body-scroll="false"
      :dismissible="!reference?.dirty"
      :show-close="false"
      @close="closeReference"
    >
      <template #header-actions>
        <div class="map-reference-close">
          <ActionButton
            icon-only
            variant="quiet"
            aria-label="Закрыть справочник тайлов"
            @click="closeReference"
            ><template #icon><X :size="20" /></template
          ></ActionButton>
        </div>
      </template>
      <MapTileReference ref="reference" :editor="e" />
    </AppModalFrame>
    <div class="map-editor">
      <MapTileSidebar
        ref="sidebar"
        :editor="e"
        :session-mode="sessionMode"
        :extra-tabs="extraTabs"
        @resize="resizeSidebar"
        @collection="changeCollection"
        @model="(id, event) => beginPlacement('placeModel', id, event)"
        @drag-tile="(id, event) => beginPlacement('dragModel', id, event)"
        @object="(id, event) => beginPlacement('placeObject', id, event)"
        @drag-object="(id, event) => beginPlacement('dragObject', id, event)"
        @tab="placement.cancel"
        @place-light="(id, event) => beginPlacement('placeLight', id, event)"
      >
        <template v-for="tab in extraTabs" :key="tab.key" #[tab.key]>
          <slot :name="tab.key" :editor="e" />
        </template>
      </MapTileSidebar>
      <div class="map-editor-main">
        <div v-if="e.error && !e.saveError" class="map-error" role="alert">
          {{ e.error }}
        </div>
        <MapCanvas
          ref="canvas"
          :active="active"
          :occlusions="canvasOcclusions"
          :document="e.draft.document"
          :state="canvasState || e.draft.state"
          :area-mode="playerPreview ? 'hide' : 'ghost'"
          :selection-color="e.areaSelectionColor"
          :selected-token="selectedToken"
          :surface-placement="surfacePlacement"
          :master="!playerPreview"
          :readonly="playerPreview || e.conflict"
          hold-to-drag
          :tool="e.tool"
          :selection="e.selection"
          :selected-object="e.tool === 'paste' ? '' : e.selectedObject"
          :selected-objects="e.tool === 'paste' ? [] : e.selectedObjects"
          :selected-tile="e.tool === 'paste' ? '' : e.selectedTile"
          :selected-tiles="e.tool === 'paste' ? [] : e.selectedTiles"
          :screen-selection="e.screenSelection"
          :hovered-tile="e.hoveredTile"
          :hovered-object="e.hoveredObject"
          :preview-tile="e.previewTile"
          :preview-object="e.previewObject"
          :show-anchors="e.showAnchors"
          edit-lights
          :selected-light="e.selectedLight"
          :hovered-light="e.hoveredLight"
          :preview-light="e.previewLight"
          :placement-light="e.tool === 'light'"
          :hint="editorHints(e.tool, e.draggingTile)"
          :catalogue="e.catalogue"
          :placement-model="
            e.draggingTile || e.tool === 'paste' ? e.selectedModel : ''
          "
          :placement-object="e.tool === 'object' ? e.objectModel : ''"
          :placement-rotation="e.placementRotation"
          :placement-hint="e.placementHint"
          @resources="e.modelMemory = $event"
          @gesture="handleGesture"
          @camera-move="placement.cursor.moved"
        />
        <MapSelectionPanel
          ref="selectionPanel"
          :editor="e"
          :custom-focus="customFocus"
          :custom-focus-key="customFocusKey"
          :back-entry="focusHistory.parent.value"
          @back="focusHistory.back"
          @focus="focusHistory.follow(() => focusEntries($event))"
          @bind="beginBinding"
          @area="focusHistory.follow(() => sidebar?.openArea($event))"
          ><template #focus><slot name="focus" :editor="e" /></template
        ></MapSelectionPanel>
      </div>
    </div>
    <MapSaveErrorDialog :editor="e" />
    <ConfirmDialog
      v-if="confirmClose"
      title="Остались несохранённые изменения"
      message="Можно вернуться в редактор и повторить сохранение. При закрытии несохранённые изменения будут потеряны."
      confirm-label="Закрыть без сохранения"
      cancel-label="Продолжить редактирование"
      :z-index="3300"
      @confirm="finishLeave(true)"
      @cancel="finishLeave(false)"
    />
  </main>
</template>
<script setup>
import { useMapFocusHistory } from "../composables/useMapFocusHistory";
import { mapEntity } from "../lib/editorEntities";
import "../styles/maps.css";
import { computed, nextTick, reactive, ref, watch } from "vue";
import {
  ActionButton,
  AppModalFrame,
  ConfirmDialog,
} from "@sylvieshare/share-ui";
import { X } from "@lucide/vue";
import MapEditorHeader from "./MapEditorHeader.vue";
import MapSelectionPanel from "./MapSelectionPanel.vue";
import MapSaveErrorDialog from "./MapSaveErrorDialog.vue";
import MapTileReference from "./MapTileReference.vue";
import MapTileSidebar from "./MapTileSidebar.vue";
import { useAccountStore } from "@/stores/account";
import { editorHints } from "../lib/editorHints";
import MapCanvas from "./MapCanvas.vue";
import { useMapEditor } from "../composables/useMapEditor";
import { useEditorPlacement } from "../composables/useEditorPlacement";
import { useMapEditorKeys } from "../composables/useMapEditorKeys";
const props = defineProps({
    map: Object,
    save: Function,
    normalize: Function,
    embedded: Boolean,
    sessionMode: Boolean,
    extraTabs: { type: Array, default: () => [] },
    selectedToken: String,
    canvasState: Object,
    surfacePlacement: Boolean,
    customFocus: Boolean,
    customFocusKey: String,
    playerPreview: Boolean,
    tokenGesture: Function,
    removeToken: Function,
    active: { type: Boolean, default: true },
  }),
  emit = defineEmits([
    "close",
    "saved",
    "working",
    "selection",
    "sidebar-resize",
  ]),
  confirmClose = ref(false);
const core = useMapEditor(props.map, (map) => emit("saved", map), {
  save: props.save,
  normalize: props.normalize,
  session: props.sessionMode,
  active: () => props.active,
});
const e = reactive({
  ...core,
  handle: handleGesture,
  removeSelected() {
    if (!props.removeToken?.()) core.removeSelected();
  },
  dismissFocus,
  focusLight,
  tokenSelected: computed(
    () =>
      props.sessionMode &&
      e.draft.state.tokens.some((t) => t.id === props.selectedToken),
  ),
  observePerformance: (changed) =>
    props.active ? canvas.value?.observePerformance(changed) : undefined,
  observeAreaFrame: (target, id, changed) =>
    canvas.value?.observeAreaFrame(target, id, changed),
  observeLightFrame: (target, id, changed) =>
    canvas.value?.observeLightFrame(target, id, changed),
});
watch(
  () => props.map,
  (model) => e.receive(model),
);
watch(
  () => e.dirty || e.saving || e.gesturing,
  (busy) => emit("working", busy),
  { immediate: true },
);
watch(
  () => [e.selectedTile, e.selectedObject, e.selectedLight, e.focusedArea],
  (ids) => {
    if (ids.some(Boolean)) emit("selection");
  },
);
function handleGesture(event) {
  if (props.tokenGesture?.(event, e, canvas.value)) return;
  if (event.phase === "start") emit("selection");
  core.handle(event);
}
const account = useAccountStore(),
  isAdmin = computed(() => account.hasRole("ADMIN"));
const reference = ref(null),
  referenceOpen = ref(false),
  canvas = ref(null),
  selectionPanel = ref(null),
  sidebar = ref(null);
const sidebarWidth = ref(
  window.matchMedia("(max-width: 760px)").matches ? 60 : 334,
);
const railWidth = ref(60);
function resizeSidebar(width, navigationWidth) {
  sidebarWidth.value = width;
  railWidth.value = navigationWidth;
  emit("sidebar-resize", width, navigationWidth);
}
function canvasOcclusions() {
  return [sidebar.value?.bounds(), selectionPanel.value?.bounds()];
}
function dismissFocus() {
  e.clearAreaFocus(true);
  e.setTileSelection([]);
  e.setObjectSelection([]);
  e.selectedLight = "";
  e.selection = null;
  emit("selection");
}
const placement = useEditorPlacement(e, canvas);
async function focusLight(id) {
  const entry = mapEntity(e.draft.document, e.catalogue, "light", id);
  if (!entry) return;
  emit("selection");
  placement.cancel();
  e.clearAreaFocus();
  e.selectLight(id);
  await nextTick();
  if (e.selectedLight !== id) return;
  canvas.value?.focusAt(entry.position);
  canvas.value?.focus();
}
function beginPlacement(method, id, event) {
  emit("selection");
  placement[method](id, event);
}
useMapEditorKeys(
  e,
  canvas,
  placement,
  () => !props.active || confirmClose.value || referenceOpen.value,
  () => props.playerPreview,
);
function openReference() {
  if (!isAdmin.value) return;
  placement.cancel();
  referenceOpen.value = true;
}
function closeReference() {
  if (reference.value?.prepareLeave() !== false) referenceOpen.value = false;
}
function changeCollection(value) {
  placement.cancel();
  e.collection = value;
}
function beginBinding(id) {
  placement.cancel();
  e.beginLightBinding(id);
}
function focusEntries(entries) {
  placement.cancel();
  e.clearAreaFocus();
  if (entries[0]?.kind === "light") {
    e.focusLight(entries[0].id);
    return;
  } else {
    e.selectedLight = "";
    e.setTileSelection(
      entries.filter((x) => x.kind === "tile").map((x) => x.id),
    );
    e.setObjectSelection(
      entries.filter((x) => x.kind === "object").map((x) => x.id),
    );
  }
  const view = canvas.value?.getView();
  if (view && entries.length)
    canvas.value.setView({
      ...view,
      fit: false,
      x:
        entries.reduce(
          (n, entry) => n + (entry.focusPosition || entry.position).x,
          0,
        ) / entries.length,
      y:
        entries.reduce(
          (n, entry) => n + (entry.focusPosition || entry.position).y,
          0,
        ) / entries.length,
    });
  canvas.value?.focus();
}

const focusHistory = useMapFocusHistory(e, {
  focusEntries,
  openArea: (id) => sidebar.value?.openArea(id),
});

let resolveLeave;
async function prepareLeave() {
  placement.cancel();
  if (reference.value?.prepareLeave() === false) {
    referenceOpen.value = true;
    return false;
  }
  if (e.saving) return false;
  if (e.dirty) await e.save();
  if (!e.dirty) return true;
  confirmClose.value = true;
  return new Promise((resolve) => {
    resolveLeave = resolve;
  });
}
function finishLeave(leave) {
  confirmClose.value = false;
  resolveLeave?.(leave);
}
defineExpose({ prepareLeave, editor: e, canvas, openReference, focusEntries });
</script>

<style scoped>
.map-editor-workspace--embedded {
  height: 100%;
}

.map-reference-close {
  display: flex;
  justify-content: flex-end;
  width: 100%;
}
</style>
