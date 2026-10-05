import { nextTick, onBeforeUnmount } from "vue";

// The drop target is a Three.js world coordinate, rather than a sortable DOM slot.
export function useCatalogueDrag(editor, canvas) {
  let pointer = null,
    pointerEvent = null,
    fillKey = false,
    keyboardPoint = null,
    freePlacement = false;
  function keyboardAnchor(point) {
    if (!point) return null;
    const snap = (p) => ({
      ...p,
      x: Math.floor(p.x + 1e-8) + 0.5,
      y: Math.floor(p.y + 1e-8) + 0.5,
    });
    return { ...snap(point), candidates: point.candidates?.map(snap) };
  }
  function cleanup() {
    if (pointer?.element.hasPointerCapture(pointer.id))
      pointer.element.releasePointerCapture(pointer.id);
    pointer = null;
    pointerEvent = null;
    keyboardPoint = null;
    freePlacement = false;
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", drop);
    window.removeEventListener("pointercancel", cancel);
    window.removeEventListener("keydown", key);
    window.removeEventListener("keyup", key);
    window.removeEventListener("blur", cancel);
    window.removeEventListener("pointerdown", freeDrop, true);
    window.removeEventListener("pointermove", freeMove);
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
      keyboardPoint = keyboardAnchor(center);
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
      keyboardPoint = keyboardAnchor(center);
      editor.tileDrag.move(keyboardPoint, { fill: fillKey });
    }
  }
  function freeMove(event) {
    if (!freePlacement) return;
    pointerEvent = event;
    editor.tileDrag.move(canvas.value?.pointAt(event), {
      fill: event.metaKey || event.ctrlKey,
    });
  }
  function freeDrop(event) {
    if (!freePlacement || event.button !== 0) return;
    const point = canvas.value?.pointAt(event);
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();
    editor.tileDrag.drop(point, { fill: event.metaKey || event.ctrlKey });
    cleanup();
  }
  async function place(id, event) {
    cancel();
    editor.tileDrag.begin(id);
    freePlacement = true;
    await nextTick();
    pointerEvent = event;
    editor.tileDrag.move(
      canvas.value?.pointAt(event) || canvas.value?.centerPoint(),
    );
    window.addEventListener("pointermove", freeMove);
    window.addEventListener("pointerdown", freeDrop, true);
    window.addEventListener("keydown", key);
    window.addEventListener("keyup", key);
    window.addEventListener("blur", cancel);
  }
  return { begin, place, cancel, cameraMoved };
}
