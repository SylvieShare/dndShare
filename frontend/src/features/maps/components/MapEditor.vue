<template>
  <main class="map-editor-workspace">
    <MapEditorHeader
      :editor="e"
      :view="view"
      :admin="isAdmin"
      @close="emit('close')"
      @view="setView"
      @collection="
        catalogueDrag.cancel();
        e.resetGesture();
        e.collection = $event;
      "
    />
    <MapItemsLibrary
      v-if="view === 'items'"
      :editor="e"
      :reference-links="isAdmin"
      @reference="openTileReference"
      @model="placeModel"
      @object="placeObject"
    />
    <MapEditorSettings
      v-if="view === 'settings'"
      :editor="e"
      @tool="startTool"
    />
    <MapTileReference
      v-if="referenceOpened && isAdmin"
      v-show="view === 'reference'"
      ref="reference"
      :editor="e"
    />
    <div v-show="view === 'map'" class="map-editor">
      <MapTileSidebar
        v-if="e.draft.document.kind === 'tiles'"
        :editor="e"
        :reference-links="isAdmin"
        @reference="openTileReference"
        @model="placeModel"
        @drag-tile="dragModel"
      />
      <div class="map-editor-main">
        <MapEditorActions :editor="e" @export="exportMap" @tool="startTool" />
        <div v-if="e.error" class="map-error" role="alert">
          {{ e.error }}
          <ActionButton v-if="!e.conflict" variant="quiet" @click="e.save"
            >Повторить сохранение</ActionButton
          >
        </div>
        <MapCanvas
          ref="canvas"
          :document="e.draft.document"
          master
          :tool="e.tool"
          :selected-zone="e.selectedZone"
          :show-zones="e.tool.startsWith('zone')"
          :selection="e.selection"
          :selected-object="e.tool === 'paste' ? '' : e.selectedObject"
          :selected-tile="e.tool === 'paste' ? '' : e.selectedTile"
          :selected-tiles="e.tool === 'paste' ? [] : e.selectedTiles"
          :screen-selection="e.screenSelection"
          :hovered-tile="e.hoveredTile"
          :preview-tile="e.previewTile"
          :preview-object="e.previewObject"
          :show-anchors="e.showAnchors"
          :hint="editorHints(e.tool, e.draggingTile)"
          :catalogue="e.catalogue"
          :placement-model="
            e.draggingTile || e.tool === 'paste' ? e.selectedModel : ''
          "
          :placement-rotation="e.placementRotation"
          :placement-hint="e.placementHint"
          @gesture="e.handle"
          @camera-move="cursor.moved"
        />
      </div>
    </div>
    <ConfirmDialog
      v-if="confirmClose"
      title="Остались несохранённые изменения"
      message="Можно вернуться в редактор и повторить сохранение или скачать карту. При закрытии несохранённые изменения будут потеряны."
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
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
} from "vue";
import { ActionButton, ConfirmDialog } from "@sylvieshare/share-ui";
import MapEditorHeader from "./MapEditorHeader.vue";
import MapEditorActions from "./MapEditorActions.vue";
import MapItemsLibrary from "./MapItemsLibrary.vue";
import MapEditorSettings from "./MapEditorSettings.vue";
import MapTileReference from "./MapTileReference.vue";
import MapTileSidebar from "./MapTileSidebar.vue";
import { useAccountStore } from "@/stores/account";
import { editorHints } from "../lib/editorHints";
import MapCanvas from "./MapCanvas.vue";
import { useMapEditor } from "../composables/useMapEditor";
import { useCatalogueDrag } from "../composables/useCatalogueDrag";
import { useMapCursor } from "../composables/useMapCursor";
import { snap } from "../lib/mapModel";
const props = defineProps({ map: Object }),
  emit = defineEmits(["close", "saved"]),
  confirmClose = ref(false);
const e = reactive(useMapEditor(props.map, (map) => emit("saved", map)));
const account = useAccountStore(),
  isAdmin = computed(() => account.hasRole("ADMIN"));
const reference = ref(null),
  referenceOpened = ref(false);
const canvas = ref(null),
  catalogueDrag = useCatalogueDrag(e, canvas);
const cursor = useMapCursor(e, canvas, catalogueDrag);
const view = ref("map");
function setView(next) {
  if (next === "reference") {
    if (!isAdmin.value) return;
    referenceOpened.value = true;
  }
  catalogueDrag.cancel();
  e.resetGesture();
  view.value = next;
}
async function openTileReference(id) {
  if (!isAdmin.value) return;
  setView("reference");
  await nextTick();
  reference.value?.choose(id);
}
function dragModel(id, event) {
  e.resetGesture();
  catalogueDrag.begin(id, event);
}
function startTool(tool) {
  setView("map");
  e.tool = tool;
}
async function placeModel(id, event) {
  setView("map");
  await nextTick();
  catalogueDrag.place(id, event);
}
async function placeObject(kind) {
  setView("map");
  await nextTick();
  e.objectKind = kind;
  e.tool = "object";
  const point = canvas.value?.centerPoint();
  if (point)
    e.previewObject = {
      id: "preview-object",
      kind,
      ...snap(e.draft.document, point),
      scale: 1,
      rotation: 0,
      open: false,
      placing: true,
    };
}
let resolveLeave;
async function prepareLeave() {
  catalogueDrag.cancel();
  e.resetGesture();
  if (reference.value?.prepareLeave() === false) {
    setView("reference");
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
function hotkey(event) {
  if (
    event.defaultPrevented ||
    confirmClose.value ||
    document.querySelector('[role="dialog"]')
  )
    return;
  if (
    view.value === "reference" ||
    event.target.closest("input,textarea,select,[contenteditable]")
  )
    return;
  if (event.key.startsWith("Arrow")) {
    event.preventDefault();
    canvas.value?.panArrow(event.key);
  }
  if (event.key === "Escape") {
    catalogueDrag.cancel();
    e.handle({ phase: "cancel" });
  }
  if ((event.metaKey || event.ctrlKey) && event.code === "KeyZ") {
    event.preventDefault();
    event.shiftKey ? e.redo() : e.undo();
  }
  if ((event.metaKey || event.ctrlKey) && event.code === "KeyS") {
    event.preventDefault();
    e.save();
  }
  if (
    (event.metaKey || event.ctrlKey) &&
    event.code === "KeyC" &&
    e.draft.document.kind === "tiles"
  ) {
    event.preventDefault();
    e.copy();
  }
  if ((event.metaKey || event.ctrlKey) && event.code === "KeyV") {
    event.preventDefault();
    setView("map");
    if (e.beginPaste())
      nextTick(() => {
        e.previewPaste(cursor.point());
        canvas.value?.focus();
      });
  }
  if (event.code === "KeyR") {
    event.preventDefault();
    e.rotate();
    nextTick(cursor.moved);
  }
  if (event.key === "Delete" || event.key === "Backspace") {
    event.preventDefault();
    e.removeSelected();
  }
}
function keyup(event) {
  canvas.value?.releaseArrow(event.key);
}
function blur() {
  canvas.value?.stopCamera();
}
function focusin(event) {
  if (event.target.closest("input,textarea,select,[contenteditable]")) blur();
}
onMounted(() => {
  window.addEventListener("keydown", hotkey);
  window.addEventListener("keyup", keyup);
  window.addEventListener("blur", blur);
  window.addEventListener("focusin", focusin);
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", hotkey);
  window.removeEventListener("keyup", keyup);
  window.removeEventListener("blur", blur);
  window.removeEventListener("focusin", focusin);
});
function exportMap() {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(e.draft, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `${e.draft.name}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
</script>
