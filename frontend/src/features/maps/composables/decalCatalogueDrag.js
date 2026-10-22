// The catalogue uses the same pointer-capture/free-placement controller as
// tiles and objects. The editor owns decal projection and the undo transaction.
export function decalCatalogueDrag(editor) {
  let active = false;
  function move(point) {
    if (active) editor.handle({ phase: "hover", point });
  }
  function cancel() {
    if (!active) return;
    active = false;
    editor.handle({ phase: "cancel" });
    editor.pauseSave(false);
  }
  return {
    kind: "decal",
    begin(image) {
      editor.beginDecal(image);
      active = true;
      editor.pauseSave(true);
    },
    move,
    drop(point) {
      if (!active) return;
      move(point);
      if (point?.decalSurface) {
        editor.handle({ phase: "start", point });
        editor.handle({ phase: "end", point });
      }
      cancel();
    },
    cancel,
  };
}
