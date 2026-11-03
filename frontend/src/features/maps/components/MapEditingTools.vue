<template>
  <div class="map-editing-tools" role="toolbar" aria-label="Действия на карте">
    <ActionButton icon-only variant="quiet" aria-label="Отменить" :disabled="!editor.history.length" @click="editor.undo"><Undo2 :size="18" /></ActionButton>
    <ActionButton icon-only variant="quiet" aria-label="Повторить" :disabled="!editor.future.length" @click="editor.redo"><Redo2 :size="18" /></ActionButton>
    <template v-if="selected || placing">
      <ActionButton icon-only variant="quiet" aria-label="Повернуть" @click="editor.rotate"><RotateCw :size="18" /></ActionButton>
      <ActionButton icon-only variant="quiet" aria-label="Отразить" @click="editor.mirror"><ArrowLeftRight :size="18" /></ActionButton>
    </template>
    <ActionButton v-if="selected" icon-only variant="quiet" aria-label="Копировать выбор" @click="editor.copy"><Copy :size="18" /></ActionButton>
    <ActionButton icon-only variant="quiet" aria-label="Вставить" @click="emit('paste')"><ClipboardPaste :size="18" /></ActionButton>
    <ActionButton v-if="selected" icon-only variant="quiet" aria-label="Удалить выбор" @click="editor.removeSelected"><Trash2 :size="18" /></ActionButton>
    <ActionButton v-if="editor.draggingTile" icon-only variant="quiet" aria-label="Заливка замкнутой области" :aria-pressed="!!editor.fillRoom" @click="emit('fill')"><LayoutGrid :size="18" /></ActionButton>
    <ActionButton v-if="placing" icon-only variant="quiet" aria-label="Отменить размещение" @click="emit('cancel')"><X :size="18" /></ActionButton>
  </div>
</template>
<script setup>
import { computed } from "vue";
import { ActionButton } from "@sylvieshare/share-ui";
import { Undo2, Redo2, RotateCw, ArrowLeftRight, Copy, ClipboardPaste, Trash2, X, LayoutGrid } from "@lucide/vue";
const props = defineProps({ editor: { type: Object, required: true } });
const emit = defineEmits(["paste", "cancel", "fill"]);
const selected = computed(() => props.editor.selectedTiles.length || props.editor.selectedObjects.length || props.editor.selectedLight || props.editor.selectedDecal || props.editor.selectedCamera);
const placing = computed(() => props.editor.draggingTile || !["select", "pan"].includes(props.editor.tool));
</script>
<style scoped>
.map-editing-tools {
  position: absolute;
  z-index: 12;
  bottom: 76px;
  left: calc(var(--map-overlay-left, 0px) + 12px);
  max-width: calc(100% - var(--map-overlay-left, 0px) - 24px);
  display: flex;
  gap: 2px;
  padding: 4px;
  overflow-x: auto;
  background: var(--popover-bg);
  border-radius: 12px;
  transition: left 260ms cubic-bezier(.2,.7,.2,1);
}
@media (prefers-reduced-motion: reduce) { .map-editing-tools { transition: none; } }
</style>
