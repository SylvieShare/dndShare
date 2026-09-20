<template>
  <AppModalFrame
    title="Редактор карты"
    :subtitle="KINDS[e.draft.document.kind]"
    fullscreen
    :padded="false"
    :body-scroll="false"
    close-label="Закрыть редактор"
    @close="close"
  >
    <template #header-actions>
      <span class="map-save-status" role="status">{{
        e.saving ? 'Сохраняем…' : e.dirty ? 'Есть изменения' : 'Сохранено'
      }}</span>
      <ActionButton :disabled="!e.dirty || e.conflict" :loading="e.saving" @click="e.save"
        ><Save :size="16" />Сохранить</ActionButton
      >
    </template>
    <div class="map-editor" @keydown="hotkey">
      <MapEditorInspector :editor="e" />
      <div class="map-editor-main">
        <div class="map-toolbar">
          <ActionButton
            :variant="e.tool === 'select' ? 'primary' : 'secondary'"
            @click="e.tool = 'select'"
            ><MousePointer2 :size="16" />Выбор</ActionButton
          >
          <ActionButton
            :variant="e.tool === 'pan' ? 'primary' : 'secondary'"
            @click="e.tool = 'pan'"
            ><Hand :size="16" />Обзор</ActionButton
          >
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
            :disabled="!e.selection"
            @click="e.copy"
            ><Copy :size="16" />Копировать участок</ActionButton
          >
          <ActionButton variant="quiet" title="Скачать карту как JSON" @click="exportMap"
            ><Download :size="16"
          /></ActionButton>
          <span class="map-toolbar-note">{{ toolHint }}</span>
        </div>
        <div v-if="e.error" class="map-error" role="alert">
          {{ e.error }}
          <ActionButton v-if="!e.conflict" variant="quiet" @click="e.save"
            >Повторить сохранение</ActionButton
          >
        </div>
        <MapCanvas
          :document="e.draft.document"
          master
          :tool="e.tool"
          :selected-zone="e.selectedZone"
          :show-zones="e.tool.startsWith('zone')"
          :selection="e.selection"
          :selected-object="e.selectedObject"
          @gesture="e.handle"
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
  </AppModalFrame>
</template>
<script setup>
import '../styles/maps.css';
import { computed, reactive, ref } from 'vue';
import { ActionButton, AppModalFrame, ConfirmDialog } from '@sylvieshare/share-ui';
import { Copy, Download, Hand, MousePointer2, Redo2, Save, Undo2 } from '@lucide/vue';
import MapCanvas from './MapCanvas.vue';
import MapEditorInspector from './MapEditorInspector.vue';
import { useMapEditor } from '../composables/useMapEditor';
import { KINDS } from '../lib/mapModel';
const props = defineProps({ map: Object }),
  emit = defineEmits(['close', 'saved']),
  confirmClose = ref(false);
const e = reactive(useMapEditor(props.map, (map) => emit('saved', map)));
const toolHint = computed(
  () =>
    ({
      brush: 'Проведите кистью по клеткам',
      fill: 'Нажмите на замкнутую область',
      rect: 'Протяните прямоугольник',
      erase: 'Возвращает базовое покрытие',
      select: 'Перемещайте объекты или выделите участок',
      pan: 'Перетаскивайте поле',
      object: 'Нажмите, чтобы поставить объект',
      zone: 'Протяните область зоны',
      'zone-brush': 'Закрасьте клетки зоны',
      paste: 'Нажмите, чтобы вставить участок',
    })[e.tool],
);
let resolveLeave;
async function prepareLeave() {
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
async function close() {
  if (await prepareLeave()) emit('close');
}
defineExpose({ prepareLeave });
function hotkey(event) {
  if (event.target.closest('input,textarea,select,[contenteditable]')) return;
  if ((event.metaKey || event.ctrlKey) && event.code === 'KeyZ') {
    event.preventDefault();
    event.shiftKey ? e.redo() : e.undo();
  }
  if ((event.metaKey || event.ctrlKey) && event.code === 'KeyS') {
    event.preventDefault();
    e.save();
  }
  if (
    (event.metaKey || event.ctrlKey) &&
    event.code === 'KeyC' &&
    e.draft.document.kind === 'tiles'
  ) {
    event.preventDefault();
    e.copy();
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    e.removeSelected();
  }
}
function exportMap() {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(e.draft, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = `${e.draft.name}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
</script>
