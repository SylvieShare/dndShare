import { inside, snap, uid } from "../lib/mapModel";
export function editorObjectDrag(e) {
  let active = false;
  function begin(modelId) {
    active = true;
    e.objectModel = modelId;
    e.objectKind = "chest";
    e.tool = "object";
    e.placementRotation = 0;
    e.pauseSave(true);
  }
  function move(point) {
    if (!active) return;
    const d = e.draft.document;
    e.previewObject =
      point && !point.invalidSurface && inside(d, point.x, point.y)
        ? {
            id: "preview-object",
            modelId: e.objectModel,
            kind: "chest",
            ...(point.placement ? point : snap(d, point)),
            scale: 1,
            rotation: e.placementRotation,
            open: false,
            placing: true,
          }
        : null;
  }
  function cancel() {
    if (!active) return;
    active = false;
    e.previewObject = null;
    e.tool = "select";
    e.pauseSave(false);
  }
  function drop(point) {
    move(point);
    if (e.previewObject) {
      const { placing, ...object } = e.previewObject;
      object.id = uid();
      e.change((m) => m.document.objects.push(object));
      e.setObjectSelection([object.id]);
      e.setTileSelection([]);
      e.error = "";
    }
    cancel();
  }
  return { kind: "object", begin, move, drop, cancel };
}
