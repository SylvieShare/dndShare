<template>
  <main class="map-editor-workspace">
    <header class="map-editor-header">
      <ActionButton
        variant="quiet"
        aria-label="Закрыть редактор"
        @click="emit('close')"
      >
        <ArrowLeft :size="18" />Карты
      </ActionButton>
      <div class="map-editor-heading">
        <h1>Редактор карты</h1>
        <span>{{ KINDS[e.draft.document.kind] }}</span>
      </div>
      <span class="map-save-status" role="status">{{
        e.saving ? "Сохраняем…" : e.dirty ? "Есть изменения" : "Сохранено"
      }}</span>
      <ActionButton
        :disabled="!e.dirty || e.conflict"
        :loading="e.saving"
        @click="e.save"
        ><Save :size="16" />Сохранить</ActionButton
      >
    </header>
    <div class="map-editor">
      <MapEditorInspector :editor="e" @drag-tile="catalogueDrag.begin" />
      <div class="map-editor-main">
        <div class="map-toolbar" role="toolbar" aria-label="Действия карты">
          <span
            class="map-selection-count"
            role="status"
            aria-label="Выбрано плиток"
            >Выбрано: {{ e.selectedTiles.length }}</span
          >
          <RemoveButton
            icon="trash"
            variant="boxed"
            :disabled="!e.selectedTiles.length && !e.selectedObject"
            :label="
              e.selectedTiles.length > 1
                ? 'Удалить плитки'
                : e.selectedTiles.length
                  ? 'Удалить плитку'
                  : 'Удалить объект'
            "
            @click="e.removeSelected"
          />
          <ActionButton
            variant="quiet"
            :disabled="!e.history.length"
            title="Отменить · Ctrl/Cmd+Z"
            @click="e.undo"
            ><Undo2 :size="17"
          /></ActionButton>
          <ActionButton
            variant="quiet"
            :disabled="!e.future.length"
            title="Повторить · Ctrl/Cmd+Shift+Z"
            @click="e.redo"
            ><Redo2 :size="17"
          /></ActionButton>
          <ActionButton
            v-if="e.draft.document.kind === 'tiles'"
            variant="quiet"
            :disabled="!e.selection && !e.selectedTiles.length"
            aria-label="Копировать участок"
            title="Копировать участок · Ctrl/Cmd+C"
            @click="e.copy"
            ><Copy :size="16"
          /></ActionButton>
          <ActionButton
            variant="quiet"
            title="Скачать карту как JSON"
            @click="exportMap"
            ><Download :size="16"
          /></ActionButton>
        </div>
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
          :show-connections="e.selectedTiles.length === 1 && !e.draggingTile"
          :connection-mask="connections.mask"
          :connection-invalid="connections.invalid"
          :hint="`${toolHint} · Cmd + клик/рамка: группа · Cmd + перенос: заполнить · Стрелки: камера · Alt: сдвиг · ПКМ/Shift: вращение`"
          :catalogue="e.catalogue"
          @gesture="e.handle"
          @connection="connections.toggle"
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
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import {
  ActionButton,
  ConfirmDialog,
  RemoveButton,
} from "@sylvieshare/share-ui";
import { ArrowLeft, Copy, Download, Redo2, Save, Undo2 } from "@lucide/vue";
import MapCanvas from "./MapCanvas.vue";
import MapEditorInspector from "./MapEditorInspector.vue";
import { useMapEditor } from "../composables/useMapEditor";
import { useCatalogueDrag } from "../composables/useCatalogueDrag";
import { useTileConnections } from "../composables/useTileConnections";
import { KINDS } from "../lib/mapModel";
const props = defineProps({ map: Object }),
  emit = defineEmits(["close", "saved"]),
  confirmClose = ref(false);
const e = reactive(useMapEditor(props.map, (map) => emit("saved", map)));
const canvas = ref(null),
  catalogueDrag = useCatalogueDrag(e, canvas);
const connections = reactive(useTileConnections(e));
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
    catalogueDrag.cameraMoved();
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
  if (event.code === "KeyR") {
    event.preventDefault();
    e.rotate();
  }
  if (event.key === "Delete" || event.key === "Backspace") {
    event.preventDefault();
    e.removeSelected();
  }
}
onMounted(() => window.addEventListener("keydown", hotkey));
onBeforeUnmount(() => window.removeEventListener("keydown", hotkey));
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
