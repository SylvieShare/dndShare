import { decalCatalogueDrag } from "./decalCatalogueDrag";
import { useCatalogueDrag } from "./useCatalogueDrag";
import { useMapCursor } from "./useMapCursor";
import { editorObjectDrag } from "./editorObjectDrag";
export function useEditorPlacement(editor, canvas) {
  const tiles = useCatalogueDrag(editor, canvas),
    objects = useCatalogueDrag(editor, canvas, editorObjectDrag(editor)),
    lights = useCatalogueDrag(editor, canvas, editor.lightDrag),
    decals = useCatalogueDrag(editor, canvas, decalCatalogueDrag(editor));
  const cursor = useMapCursor(editor, canvas, {
    cameraMoved() {
      tiles.cameraMoved();
      objects.cameraMoved();
      lights.cameraMoved();
      decals.cameraMoved();
    },
  });
  function cancel() {
    tiles.cancel();
    objects.cancel();
    lights.cancel();
    decals.cancel();
    editor.resetGesture();
  }
  return {
    cursor,
    cancel,
    dragModel(id, event) {
      objects.cancel();
      lights.cancel();
      decals.cancel();
      editor.resetGesture();
      editor.selectedLight = "";
      tiles.begin(id, event);
    },
    dragObject(id, event) {
      tiles.cancel();
      lights.cancel();
      decals.cancel();
      editor.resetGesture();
      editor.selectedLight = "";
      objects.begin(id, event);
    },
    dragDecal(image, event) {
      cancel();
      decals.begin(image, event);
    },
    placeDecal(image, event = cursor.pointerEvent()) {
      cancel();
      decals.place(image, event, { repeatOnCommand: true });
    },
    placeModel(id, event) {
      cancel();
      editor.selectedLight = "";
      tiles.place(id, event);
    },
    placeObject(id, event) {
      cancel();
      editor.selectedLight = "";
      objects.place(id, event);
    },
    placeLight(kind, event, options) {
      cancel();
      lights.place(kind, event, options);
    },
  };
}
