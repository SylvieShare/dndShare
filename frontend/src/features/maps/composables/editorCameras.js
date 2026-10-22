import { computed, ref } from "vue";
import {
  cameraFromEditor,
  translatedCamera,
  cameraWithView,
} from "../lib/sceneCameras";
import { uid, clone } from "../lib/mapModel";
export function editorCameras(getEditor, captureView) {
  const showCameras = ref(true),
    selectedCamera = ref(""),
    previewCamera = ref(null),
    hoveredCamera = ref(""),
    hoveredCameraPart = ref(""),
    draggingCameraPart = ref("");
  let drag,
    editKey = "",
    editTimer;
  const focusedCamera = computed(() =>
    previewCamera.value?.id === selectedCamera.value
      ? previewCamera.value
      : getEditor().draft.document.cameras?.find(
          (c) => c.id === selectedCamera.value,
        ),
  );
  function finishCameraEdit() {
    clearTimeout(editTimer);
    if (!editKey) return;
    editKey = "";
    getEditor().commitEdit();
  }
  function resetDrag() {
    const busy = !!drag;
    previewCamera.value = null;
    draggingCameraPart.value = "";
    drag = null;
    if (busy) getEditor().pauseSave(false);
  }
  function clear() {
    finishCameraEdit();
    resetDrag();
    selectedCamera.value = hoveredCamera.value = hoveredCameraPart.value = "";
  }
  function focus(id) {
    getEditor().dismissFocus();
    selectedCamera.value = id;
    getEditor().tool = "select";
  }
  function start() {
    const view = captureView();
    if (!view) {
      getEditor().error = "Текущий вид камеры ещё загружается";
      return;
    }
    if ((getEditor().draft.document.cameras?.length || 0) >= 64) return;
    const camera = {
      id: uid(),
      name: `Камера ${(getEditor().draft.document.cameras?.length || 0) + 1}`,
      view: cameraFromEditor(view),
    };
    getEditor().dismissFocus();
    getEditor().change((m) => (m.document.cameras ||= []).push(camera));
    selectedCamera.value = camera.id;
    getEditor().tool = "select";
  }
  function update(fn) {
    finishCameraEdit();
    if (!focusedCamera.value) return;
    getEditor().change((m) => {
      const current = m.document.cameras.find(
        (c) => c.id === selectedCamera.value,
      );
      if (!current) return;
      const next = clone(current);
      fn(next);
      const adjusted = cameraWithView(current, next.view);
      if (adjusted) Object.assign(current, next, { view: adjusted.view });
    });
  }
  function editCamera(field, value) {
    const current = getEditor().draft.document.cameras?.find(
      (c) => c.id === selectedCamera.value,
    );
    if (!current) return;
    const view = clone(current.view);
    if (field === "height") view.position[2] = value;
    else if (field === "width") view.width = value;
    else return;
    const next = cameraWithView(current, view);
    if (!next) return;
    if (editKey !== field) {
      finishCameraEdit();
      getEditor().finishLightEdit?.();
      getEditor().finishDecalEdit?.();
      getEditor().checkpoint();
      editKey = field;
    }
    current.view = next.view;
    clearTimeout(editTimer);
    editTimer = setTimeout(finishCameraEdit, 350);
  }
  function remove() {
    if (!selectedCamera.value) return false;
    finishCameraEdit();
    const id = selectedCamera.value;
    getEditor().change(
      (m) =>
        (m.document.cameras = m.document.cameras.filter((c) => c.id !== id)),
    );
    clear();
    return true;
  }
  function gesture({ phase, point, hit }) {
    if (phase === "hover") {
      hoveredCamera.value = hit?.cameraId || "";
      hoveredCameraPart.value = hit?.cameraId ? hit.cameraPart || "body" : "";
      return false;
    }
    if (phase === "cancel") {
      const handled = !!drag;
      resetDrag();
      hoveredCamera.value = hoveredCameraPart.value = "";
      return handled;
    }
    if (phase === "start" && hit?.cameraId && getEditor().tool === "select") {
      focus(hit.cameraId);
      if (point && focusedCamera.value) {
        drag = {
          camera: clone(focusedCamera.value),
          origin: { ...point },
          part: hit.cameraPart || "body",
        };
        getEditor().pauseSave(true);
      }
      return true;
    }
    if (!drag) return false;
    if (phase === "hold") draggingCameraPart.value = drag.part;
    if (phase === "move" && point) {
      const camera = drag.camera;
      const next =
        drag.part === "target"
          ? cameraWithView(camera, {
              ...camera.view,
              target: [point.x, point.y, point.elevation ?? 0.44],
            })
          : translatedCamera(camera, drag.origin, point);
      if (next) {
        previewCamera.value = next;
        draggingCameraPart.value = drag.part;
      }
    }
    if (phase === "end") {
      if (previewCamera.value) {
        const view = previewCamera.value.view;
        update((c) => (c.view = view));
      }
      resetDrag();
    }
    return true;
  }
  return {
    showCameras,
    selectedCamera,
    previewCamera,
    focusedCamera,
    hoveredCamera,
    hoveredCameraPart,
    draggingCameraPart,
    focusCamera: focus,
    placeCamera: start,
    updateCamera: update,
    editCamera,
    finishCameraEdit,
    removeCamera: remove,
    clearCamera: clear,
    cameraGesture: gesture,
    disposeCameras() {
      finishCameraEdit();
      resetDrag();
    },
  };
}
