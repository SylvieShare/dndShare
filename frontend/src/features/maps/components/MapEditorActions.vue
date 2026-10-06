<template>
  <WorkspaceToolsRail role="toolbar" aria-label="Действия карты">
    <ActionButton
      v-if="editor.draft.document.kind === 'tiles'"
      :variant="editor.tool === 'wall-brush' ? 'primary' : 'secondary'"
      :aria-pressed="editor.tool === 'wall-brush'"
      aria-label="Кисть стенами"
      title="Кисть стенами"
      @click="
        emit('tool', editor.tool === 'wall-brush' ? 'select' : 'wall-brush')
      "
      ><Paintbrush :size="20" />
    </ActionButton>
    <span class="map-selection-count" role="status" aria-label="Выбрано плиток"
      >Выбрано: {{ editor.selectedTiles.length }}</span
    >
    <span
      v-if="editor.selectedObjects.length"
      class="map-selection-count"
      role="status"
      aria-label="Выбрано объектов"
      >Объектов: {{ editor.selectedObjects.length }}</span
    >
    <RemoveButton
      icon="trash"
      variant="boxed"
      :disabled="!editor.selectedTiles.length && !editor.selectedObject"
      :label="
        editor.selectedTiles.length && editor.selectedObjects.length
          ? 'Удалить выбранное'
          : editor.selectedObjects.length > 1
            ? 'Удалить объекты'
            : editor.selectedTiles.length > 1
              ? 'Удалить плитки'
              : editor.selectedTiles.length
                ? 'Удалить плитку'
                : 'Удалить объект'
      "
      @click="editor.removeSelected"
    />
    <ActionButton
      variant="secondary"
      :disabled="!editor.history.length"
      title="Отменить · Ctrl/Cmd+Z"
      @click="editor.undo"
      ><Undo2 :size="20"
    /></ActionButton>
    <ActionButton
      variant="secondary"
      :disabled="!editor.future.length"
      title="Повторить · Ctrl/Cmd+Shift+Z"
      @click="editor.redo"
      ><Redo2 :size="20"
    /></ActionButton>
    <ActionButton
      v-if="editor.draft.document.kind === 'tiles'"
      variant="secondary"
      :disabled="
        !editor.selection &&
        !editor.selectedTiles.length &&
        !editor.selectedObject
      "
      aria-label="Копировать участок"
      title="Копировать участок · Ctrl/Cmd+C"
      @click="editor.copy"
      ><Copy :size="20"
    /></ActionButton>
    <ActionButton
      variant="secondary"
      title="Скачать карту как JSON"
      @click="emit('export')"
      ><Download :size="20"
    /></ActionButton>
  </WorkspaceToolsRail>
</template>
<script setup>
import { ActionButton, RemoveButton } from "@sylvieshare/share-ui";
import { Copy, Download, Paintbrush, Redo2, Undo2 } from "@lucide/vue";
import WorkspaceToolsRail from "@/shared/ui/WorkspaceToolsRail.vue";
defineProps({ editor: Object });
const emit = defineEmits(["export", "tool"]);
</script>
