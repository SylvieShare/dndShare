import { useCatalogueDrag } from "./useCatalogueDrag";
import { useMapCursor } from "./useMapCursor";
import { editorObjectDrag } from "./editorObjectDrag";
export function useEditorPlacement(editor, canvas) {
  const tiles = useCatalogueDrag(editor, canvas),
    objects = useCatalogueDrag(editor, canvas, editorObjectDrag(editor)),
    lights = useCatalogueDrag(editor, canvas, editor.lightDrag);
  const cursor = useMapCursor(editor, canvas, {
    cameraMoved() {
      tiles.cameraMoved();
      objects.cameraMoved();
      lights.cameraMoved();
    },
  });
  function cancel() {
    tiles.cancel();
    objects.cancel();
    lights.cancel();
    editor.resetGesture();
  }
  return {
    cursor,
    cancel,
    dragModel(id, event) {
      objects.cancel();
      lights.cancel();
      editor.resetGesture();
      editor.selectedLight = "";
      tiles.begin(id, event);
    },
    dragObject(id, event) {
      tiles.cancel();
      lights.cancel();
      editor.resetGesture();
      editor.selectedLight = "";
      objects.begin(id, event);
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
    placeLight(kind, event) {
      cancel();
      lights.place(kind, event);
    },
  };
}
