import { onBeforeUnmount, onMounted } from "vue";

export function useMapCursor(editor, canvas, catalogueDrag) {
  let pointer = null;
  const remember = (event) => {
    pointer = { clientX: event.clientX, clientY: event.clientY };
  };
  const point = () =>
    pointer ? canvas.value?.pointAt(pointer) : canvas.value?.centerPoint();
  function moved() {
    catalogueDrag.cameraMoved();
    if (editor.tool === "paste") editor.previewPaste(point());
  }
  onMounted(() => {
    window.addEventListener("pointermove", remember);
    window.addEventListener("pointerdown", remember);
  });
  onBeforeUnmount(() => {
    window.removeEventListener("pointermove", remember);
    window.removeEventListener("pointerdown", remember);
  });
  return {
    point,
    moved,
    pointerEvent: () =>
      pointer ? { ...pointer, type: "pointermove" } : { type: "keydown" },
  };
}
