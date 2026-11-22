<template>
  <TransitionGroup tag="div" name="map-editing-tool" class="map-editing-tools" role="toolbar" aria-label="Действия на карте"
    @before-enter="item => { item.inert = false }" @before-leave="item => { item.inert = true }">
    <span v-for="tool in tools" :key="tool.label" class="map-editing-tool">
      <ActionButton icon-only :variant="tool.danger ? 'secondary' : 'quiet'"
        :class="{ 'map-editing-tool--danger': tool.danger }" :aria-label="tool.label"
        :aria-pressed="tool.pressed" :disabled="tool.disabled" @click="tool.run">
        <component :is="tool.icon" :size="18" aria-hidden="true" />
      </ActionButton>
    </span>
  </TransitionGroup>
</template>
<script setup>
import { computed } from "vue";
import { ActionButton } from "@sylvieshare/share-ui";
import { Undo2, Redo2, RotateCw, ArrowLeftRight, Copy, ClipboardPaste, Trash2, X, LayoutGrid } from "@lucide/vue";
const props = defineProps({ editor: { type: Object, required: true } });
const emit = defineEmits(["paste", "cancel", "fill"]);
const selected = computed(() => props.editor.selectedTiles.length || props.editor.selectedObjects.length || props.editor.selectedLight || props.editor.selectedDecal || props.editor.selectedCamera);
const placing = computed(() => props.editor.draggingTile || !["select", "pan"].includes(props.editor.tool));
const tools = computed(() => {
  const editor = props.editor;
  return [
    { label: "Отменить", icon: Undo2, disabled: !editor.history.length, run: () => editor.undo() },
    { label: "Повторить", icon: Redo2, disabled: !editor.future.length, run: () => editor.redo() },
    ...(selected.value || placing.value ? [
      { label: "Повернуть", icon: RotateCw, run: () => editor.rotate() },
      { label: "Отразить", icon: ArrowLeftRight, run: () => editor.mirror() },
    ] : []),
    ...(selected.value ? [{ label: "Копировать выбор", icon: Copy, run: () => editor.copy() }] : []),
    { label: "Вставить", icon: ClipboardPaste, run: () => emit("paste") },
    ...(selected.value ? [{ label: "Удалить выбор", icon: Trash2, danger: true, run: () => editor.removeSelected() }] : []),
    ...(editor.draggingTile ? [{
      label: "Заливка замкнутой области", icon: LayoutGrid, pressed: !!editor.fillRoom, run: () => emit("fill"),
    }] : []),
    ...(placing.value ? [{ label: "Отменить размещение", icon: X, run: () => emit("cancel") }] : []),
  ];
});
</script>
<style scoped>
.map-editing-tools {
  box-sizing: border-box;
  max-width: 100%;
  display: flex;
  padding: 4px 2px 4px 4px;
  overflow-x: auto;
  background: var(--popover-bg);
  border-radius: 12px;
  pointer-events: auto;
}
.map-editing-tool {
  display: flex;
  flex: none;
  width: calc(var(--layout-touch-min) + 2px);
}
.map-editing-tool--danger {
  --action-button-bg: transparent;
  --action-button-fg: var(--danger);
  --action-button-hover-bg: color-mix(in srgb, var(--danger) 13%, transparent);
  --action-button-hover-fg: var(--danger);
}
.map-editing-tool-enter-active,
.map-editing-tool-leave-active {
  overflow: clip;
  transition: width var(--motion-enter) cubic-bezier(.2,.7,.2,1), opacity var(--motion-feedback) ease;
}
.map-editing-tool-enter-from,
.map-editing-tool-leave-to {
  width: 0;
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .map-editing-tool-enter-active,
  .map-editing-tool-leave-active { transition: none; }
}
</style>
