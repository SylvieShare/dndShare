import { clone } from "../lib/mapModel";
import { dragDecalSurface } from "../lib/decalDragSurface";

export function editorDecalDrag(e, preview) {
  let gesture;
  function reset() {
    if (!gesture) return;
    gesture = null;
    preview.value = null;
    e.pauseSave(false);
  }
  return {
    get active() {
      return !!gesture;
    },
    start(decal, point, event) {
      gesture = {
        decal: clone(decal),
        grab: point?.decalSurface,
        screen: { x: event?.clientX, y: event?.clientY },
        moved: false,
      };
      e.pauseSave(true);
    },
    handle({ phase, point, event }) {
      if (!gesture) return false;
      if (phase === "hold")
        preview.value = { ...gesture.decal, moving: true, valid: true };
      if (phase === "move") {
        const surface = dragDecalSurface(
          gesture.decal,
          gesture.grab,
          point?.decalSurface,
        );
        if (
          surface &&
          (gesture.moved ||
            Math.hypot(
              event.clientX - gesture.screen.x,
              event.clientY - gesture.screen.y,
            ) >= 5)
        ) {
          gesture.moved = true;
          preview.value = {
            ...gesture.decal,
            ...surface,
            moving: true,
            valid: true,
          };
        } else if (!surface && preview.value)
          preview.value = { ...preview.value, valid: false };
      }
      if (phase === "cancel") reset();
      if (phase === "end") {
        if (gesture.moved && point?.decalSurface && preview.value?.valid) {
          const { moving, valid, ...decal } = clone(preview.value);
          e.change((m) => {
            const item = m.document.decals?.find((d) => d.id === decal.id);
            if (item) Object.assign(item, decal);
          });
        }
        reset();
      }
      return phase !== "hover";
    },
    reset,
  };
}
