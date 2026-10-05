import { onBeforeUnmount } from "vue";

// The drop target is a Three.js world coordinate, rather than a sortable DOM slot.
export function useCatalogueDrag(editor, canvas) {
  let pointer = null,
    pointerEvent = null,
    fillKey = false,
    keyboardPoint = null;
  function cleanup() {
    if (pointer?.element.hasPointerCapture(pointer.id))
      pointer.element.releasePointerCapture(pointer.id);
    pointer = null;
    pointerEvent = null;
    keyboardPoint = null;
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", drop);
    window.removeEventListener("pointercancel", cancel);
    window.removeEventListener("keydown", key);
    window.removeEventListener("keyup", key);
    window.removeEventListener("blur", cancel);
  }
  function cancel() {
    editor.tileDrag.cancel();
    cleanup();
  }
  function move(event) {
    if (event.pointerId !== pointer?.id) return;
    pointerEvent = event;
    fillKey = event.metaKey || event.ctrlKey;
    editor.tileDrag.move(canvas.value?.pointAt(event), { fill: fillKey });
  }
  function drop(event) {
    if (event.pointerId !== pointer?.id) return;
    editor.tileDrag.drop(canvas.value?.pointAt(event), {
      fill: event.metaKey || event.ctrlKey,
    });
    cleanup();
  }
  function key(event) {
    if (["Meta", "Control"].includes(event.key)) {
      fillKey = event.metaKey || event.ctrlKey;
      if (pointerEvent)
        editor.tileDrag.move(canvas.value?.pointAt(pointerEvent), {
          fill: fillKey,
        });
    }
    if (event.type === "keyup") return;
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
    if (!keyboardPoint) return;
    if (event.key === "Enter") {
      event.preventDefault();
      editor.tileDrag.drop(keyboardPoint, { fill: fillKey });
      cleanup();
    }
  }
  function begin(id, event) {
    if (event.type === "pointerdown" && event.button !== 0) return;
    cancel();
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    editor.tileDrag.begin(id);
    if (event.type === "pointerdown") {
      pointer = { id: event.pointerId, element: event.currentTarget };
      pointer.element.setPointerCapture(pointer.id);
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", drop);
      window.addEventListener("pointercancel", cancel);
    } else {
      const center = canvas.value?.centerPoint();
      keyboardPoint = center && {
        x: Math.floor(center.x) + 0.5,
        y: Math.floor(center.y) + 0.5,
      };
      editor.tileDrag.move(keyboardPoint);
      canvas.value?.focus();
    }
    window.addEventListener("keydown", key);
    window.addEventListener("keyup", key);
    window.addEventListener("blur", cancel);
  }
  onBeforeUnmount(cancel);
  function cameraMoved() {
    if (pointerEvent)
      editor.tileDrag.move(canvas.value?.pointAt(pointerEvent), {
        fill: fillKey,
      });
    if (keyboardPoint) {
      const center = canvas.value.centerPoint();
      keyboardPoint = {
        x: Math.floor(center.x) + 0.5,
        y: Math.floor(center.y) + 0.5,
      };
      editor.tileDrag.move(keyboardPoint, { fill: fillKey });
    }
  }
  return { begin, cancel, cameraMoved };
}
