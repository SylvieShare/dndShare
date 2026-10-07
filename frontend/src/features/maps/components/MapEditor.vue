<template>
  <main class="map-editor-workspace">
    <MapEditorHeader
      :editor="e"
      :admin="isAdmin"
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
        :editor="e"
        @collection="changeCollection"
        @model="placement.placeModel"
        @drag-tile="placement.dragModel"
        @object="placement.placeObject"
        @drag-object="placement.dragObject"
        @tab="placement.cancel"
        @place-light="placement.placeLight"
      />
      <div class="map-editor-main">
        <div v-if="e.error && !e.saveError" class="map-error" role="alert">
          {{ e.error }}
        </div>
        <MapCanvas
          ref="canvas"
          :document="e.draft.document"
          master
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
          @gesture="e.handle"
          @camera-move="placement.cursor.moved"
        />
        <MapSelectionPanel
          :editor="e"
          @focus="focusEntries"
          @bind="beginBinding"
        />
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
import "../styles/maps.css";
import { computed, reactive, ref } from "vue";
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
const props = defineProps({ map: Object }),
  emit = defineEmits(["close", "saved"]),
  confirmClose = ref(false);
const e = reactive(useMapEditor(props.map, (map) => emit("saved", map)));
const account = useAccountStore(),
  isAdmin = computed(() => account.hasRole("ADMIN"));
const reference = ref(null),
  referenceOpen = ref(false),
  canvas = ref(null);
const placement = useEditorPlacement(e, canvas);
useMapEditorKeys(
  e,
  canvas,
  placement,
  () => confirmClose.value || referenceOpen.value,
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
  if (entries[0]?.kind === "light") e.selectLight(entries[0].id);
  else {
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
defineExpose({ prepareLeave });
</script>

<style scoped>
.map-reference-close {
  display: flex;
  justify-content: flex-end;
  width: 100%;
}
</style>
