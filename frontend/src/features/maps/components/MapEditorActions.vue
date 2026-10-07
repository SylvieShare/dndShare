<template>
  <div class="map-header-actions" role="toolbar" aria-label="Действия карты">
    <ActionButton
      icon-only
      variant="quiet"
      :disabled="!editor.history.length"
      aria-label="Отменить"
      title="Отменить · Ctrl/Cmd+Z"
      @click="editor.undo"
    >
      <template #icon><Undo2 :size="20" /></template>
    </ActionButton>
    <ActionButton
      icon-only
      variant="quiet"
      :disabled="!editor.future.length"
      aria-label="Повторить"
      title="Повторить · Ctrl/Cmd+Shift+Z"
      @click="editor.redo"
    >
      <template #icon><Redo2 :size="20" /></template>
    </ActionButton>
    <ActionButton
      icon-only
      variant="quiet"
      :disabled="!hasSelection"
      aria-label="Копировать выбранное"
      title="Копировать выбранное · Ctrl/Cmd+C"
      @click="editor.copy"
    >
      <template #icon><Copy :size="20" /></template>
    </ActionButton>
    <ActionButton
      icon-only
      variant="quiet"
      :disabled="!hasSelection"
      :aria-label="deleteLabel"
      title="Удалить выбранное · Delete"
      @click="editor.removeSelected"
    >
      <template #icon><Trash2 :size="20" /></template>
    </ActionButton>
  </div>
</template>
<script setup>
import { computed } from "vue";
import { ActionButton } from "@sylvieshare/share-ui";
import { Copy, Redo2, Trash2, Undo2 } from "@lucide/vue";
const props = defineProps({ editor: Object });
const deleteLabel = computed(() => {
  const e = props.editor;
  if (e.selectedTiles.length && e.selectedObjects.length)
    return "Удалить выделение";
  if (e.selectedTiles.length)
    return e.selectedTiles.length === 1 ? "Удалить плитку" : "Удалить плитки";
  if (e.selectedObjects.length)
    return e.selectedObjects.length === 1
      ? "Удалить объект"
      : "Удалить объекты";
  return "Удалить источник света";
});
const hasSelection = computed(
  () =>
    !!(
      props.editor.selectedTiles.length ||
      props.editor.selectedObjects.length ||
      props.editor.selectedLight
    ),
);
</script>
<style scoped>
.map-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
