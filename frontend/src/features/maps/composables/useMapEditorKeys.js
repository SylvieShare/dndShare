import { nextTick, onMounted, onBeforeUnmount } from "vue";
export function useMapEditorKeys(editor, canvas, placement, blocked) {
  function keydown(event) {
    if (
      event.defaultPrevented ||
      blocked() ||
      document.querySelector('[role="dialog"]')
    )
      return;
    if (event.target.closest("input,textarea,select,[contenteditable]")) return;
    if (event.key.startsWith("Arrow")) {
      event.preventDefault();
      canvas.value?.panArrow(event.key);
    }
    if (event.key === "Escape") {
      placement.cancel();
      editor.handle({ phase: "cancel" });
    }
    const command = event.metaKey || event.ctrlKey;
    if (command && event.code === "KeyZ") {
      event.preventDefault();
      event.shiftKey ? editor.redo() : editor.undo();
    }
    if (command && event.code === "KeyS") {
      event.preventDefault();
      editor.save();
    }
    if (command && event.code === "KeyC") {
      event.preventDefault();
      editor.copy();
    }
    if (command && event.code === "KeyV") {
      event.preventDefault();
      if (editor.copiedLight)
        placement.placeLight(
          editor.copiedLight,
          placement.cursor.pointerEvent(),
        );
      else if (editor.beginPaste())
        nextTick(() => {
          editor.previewPaste(placement.cursor.point());
          canvas.value?.focus();
        });
    }
    if (event.code === "KeyR") {
      event.preventDefault();
      editor.rotate();
      nextTick(placement.cursor.moved);
    }
    if (["Delete", "Backspace"].includes(event.key)) {
      event.preventDefault();
      editor.removeSelected();
    }
  }
  const keyup = (event) => canvas.value?.releaseArrow(event.key);
  const blur = () => canvas.value?.stopCamera();
  function focusin(event) {
    if (event.target.closest("input,textarea,select,[contenteditable]")) blur();
  }
  onMounted(() => {
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", blur);
    window.addEventListener("focusin", focusin);
  });
  onBeforeUnmount(() => {
    window.removeEventListener("keydown", keydown);
    window.removeEventListener("keyup", keyup);
    window.removeEventListener("blur", blur);
    window.removeEventListener("focusin", focusin);
  });
}
