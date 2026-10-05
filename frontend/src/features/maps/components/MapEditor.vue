<template>
  <main class="map-editor-workspace">
    <MapEditorHeader
      :editor="e"
      :view="view"
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
      @model="placeModel"
      @object="placeObject"
    />
    <MapEditorSettings v-if="view === 'settings'" :editor="e" />
    <div v-show="view === 'map'" class="map-editor">
      <MapEditorInspector :editor="e" @drag-tile="catalogueDrag.begin" />
      <div class="map-editor-main">
        <MapEditorActions :editor="e" @export="exportMap" />
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
          :selected-object="e.selectedObject"
          :selected-tile="e.selectedTile"
          :selected-tiles="e.selectedTiles"
          :screen-selection="e.screenSelection"
          :hovered-tile="e.hoveredTile"
          :preview-tile="e.previewTile"
          :preview-object="e.previewObject"
          :show-anchors="e.showAnchors"
          :show-connections="
            e.selectedTiles.length === 1 &&
            !e.draggingTile &&
            connections.mode !== 'none'
          "
          :connection-mode="connections.mode"
          :connection-mask="connections.mask"
          :connection-invalid="connections.invalid"
          :hint="`${toolHint} · Cmd + клик/рамка: группа · Cmd + перенос: заполнить · Стрелки: камера · Alt: сдвиг · ПКМ/Shift: вращение`"
          :catalogue="e.catalogue"
          :placement-model="
            e.draggingTile || e.tool === 'paste' ? e.selectedModel : ''
          "
          :placement-rotation="e.placementRotation"
          @gesture="e.handle"
          @connection="connections.toggle"
          @camera-move="catalogueDrag.cameraMoved"
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
import MapCanvas from "./MapCanvas.vue";
import MapEditorInspector from "./MapEditorInspector.vue";
import { useMapEditor } from "../composables/useMapEditor";
import { useCatalogueDrag } from "../composables/useCatalogueDrag";
import { useTileConnections } from "../composables/useTileConnections";
import { snap } from "../lib/mapModel";
const props = defineProps({ map: Object }),
  emit = defineEmits(["close", "saved"]),
  confirmClose = ref(false);
const e = reactive(useMapEditor(props.map, (map) => emit("saved", map)));
const canvas = ref(null),
  catalogueDrag = useCatalogueDrag(e, canvas);
const connections = reactive(useTileConnections(e)),
  view = ref("map");
function setView(next) {
  catalogueDrag.cancel();
  e.resetGesture();
  view.value = next;
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
const toolHint = computed(
  () =>
    ({
      select: "Тайл из каталога: перетащить · R: поворот",
      object: "Нажмите, чтобы поставить объект",
      zone: "Протяните область зоны",
      "zone-brush": "Закрасьте клетки зоны",
      paste: "Нажмите, чтобы вставить участок",
      "wall-brush":
        "Рисуйте стены · Стыки подбираются автоматически · Alt: перемещение поля",
    })[e.tool],
);
let resolveLeave;
async function prepareLeave() {
  catalogueDrag.cancel();
  e.resetGesture();
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
  if (event.target.closest("input,textarea,select,[contenteditable]")) return;
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
    nextTick(() => e.beginPaste(canvas.value?.centerPoint()));
  }
  if (event.code === "KeyR") {
    event.preventDefault();
    e.rotate();
    catalogueDrag.cameraMoved();
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
