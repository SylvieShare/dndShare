import { nextTick, onBeforeUnmount } from "vue";

// The drop target is a Three.js world coordinate, rather than a sortable DOM slot.
export function useCatalogueDrag(editor, canvas, driver = editor.tileDrag) {
  let pointer = null,
    pointerEvent = null,
    fillKey = false,
    keyboardPoint = null,
    freePlacement = false;
  function keyboardAnchor(point) {
    if (!point) return null;
    if (driver.kind === "object" || driver.kind === "light") return point;
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
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", drop);
    pointerEvent = null;
    fillKey = false;
    keyboardPoint = null;
    freePlacement = false;
    window.removeEventListener("pointercancel", cancel);
    window.removeEventListener("keydown", key);
    window.removeEventListener("keyup", key);
    window.removeEventListener("blur", cancel);
    window.removeEventListener("pointerdown", freeDrop, true);
    window.removeEventListener("mousedown", rightCancel, true);
    window.removeEventListener("contextmenu", rightCancel, true);
    window.removeEventListener("pointermove", freeMove);
  }
  function cancel() {
    driver.cancel();
    cleanup();
  }
  function rightCancel(event) {
    // A second mouse button while LMB is held emits mousedown, not pointerdown.
    if (
      (event.button !== 2 && !(event.buttons & 2)) ||
      (!pointer && !freePlacement)
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    cancel();
  }
  function move(event) {
    if (event.pointerId !== pointer?.id) return;
    if (event.buttons & 2) {
      rightCancel(event);
      return;
    }
    pointerEvent = event;
    fillKey = event.metaKey || event.ctrlKey;
    driver.move(canvas.value?.pointAt(event), { fill: fillKey });
  }
  function drop(event) {
    if (event.pointerId !== pointer?.id) return;
    driver.drop(canvas.value?.pointAt(event), {
      fill: event.metaKey || event.ctrlKey,
    });
    cleanup();
  }
  function begin(id, event) {
    if (event.button !== 0) return;
    cancel();
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    driver.begin(id);
    pointer = { id: event.pointerId, element: event.currentTarget };
    pointer.element.setPointerCapture(pointer.id);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", drop);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("pointerdown", freeDrop, true);
    window.addEventListener("mousedown", rightCancel, true);
    window.addEventListener("contextmenu", rightCancel, true);
    window.addEventListener("keydown", key);
    window.addEventListener("keyup", key);
    window.addEventListener("blur", cancel);
  }
  function key(event) {
    if (["Meta", "Control"].includes(event.key)) {
      fillKey = event.metaKey || event.ctrlKey;
      if (pointerEvent)
        driver.move(canvas.value?.pointAt(pointerEvent), {
          fill: fillKey,
        });
    }
    if (event.type === "keyup") return;
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
    if (!freePlacement) return;
    if (event.key === "Enter") {
      event.preventDefault();
      driver.drop(keyboardPoint || canvas.value?.pointAt(pointerEvent), {
        fill: fillKey,
      });
      cleanup();
    }
  }
  onBeforeUnmount(cancel);
  function cameraMoved() {
    if (pointerEvent)
      driver.move(canvas.value?.pointAt(pointerEvent), {
        fill: fillKey,
      });
    if (keyboardPoint) {
      const center = canvas.value.centerPoint();
      keyboardPoint = keyboardAnchor(center);
      driver.move(keyboardPoint, { fill: fillKey });
    }
  }
  function freeMove(event) {
    if (!freePlacement) return;
    keyboardPoint = null;
    pointerEvent = event;
    fillKey = event.metaKey || event.ctrlKey;
    driver.move(canvas.value?.pointAt(event), { fill: fillKey });
  }
  function freeDrop(event) {
    if ((freePlacement || pointer) && event.button === 2) {
      event.preventDefault();
      event.stopPropagation();
      cancel();
      return;
    }
    if (!freePlacement || event.button !== 0) return;
    const point = canvas.value?.pointAt(event);
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();
    driver.drop(point, { fill: event.metaKey || event.ctrlKey });
    cleanup();
  }
  async function place(id, event = { type: "keydown" }) {
    cancel();
    fillKey = event.metaKey || event.ctrlKey;
    driver.begin(id);
    freePlacement = true;
    await nextTick();
    const keyboard = event.type.startsWith("key");
    pointerEvent = keyboard ? null : event;
    keyboardPoint = keyboard
      ? keyboardAnchor(canvas.value?.centerPoint())
      : null;
    driver.move(
      keyboardPoint ||
        canvas.value?.pointAt(event) ||
        canvas.value?.centerPoint(),
    );
    canvas.value?.focus();
    window.addEventListener("pointermove", freeMove);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("pointerdown", freeDrop, true);
    window.addEventListener("mousedown", rightCancel, true);
    window.addEventListener("contextmenu", rightCancel, true);
    window.addEventListener("keydown", key);
    window.addEventListener("keyup", key);
    window.addEventListener("blur", cancel);
  }
  return { begin, place, cancel, cameraMoved };
}
