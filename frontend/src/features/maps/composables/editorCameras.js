import { computed, ref } from "vue";
import { cameraFromEditor, translatedCamera } from "../lib/sceneCameras";
import { uid, clone } from "../lib/mapModel";
export function editorCameras(getEditor, captureView) {
  const selectedCamera = ref(""),
    previewCamera = ref(null);
  let drag;
  const focusedCamera = computed(() =>
    previewCamera.value?.id === selectedCamera.value
      ? previewCamera.value
      : getEditor().draft.document.cameras?.find(
          (c) => c.id === selectedCamera.value,
        ),
  );
  function clear() {
    selectedCamera.value = "";
    previewCamera.value = null;
    drag = null;
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
    if (!focusedCamera.value) return;
    getEditor().change((m) => {
      const camera = m.document.cameras.find(
        (c) => c.id === selectedCamera.value,
      );
      const direction = camera.view.target.map(
        (n, i) => n - camera.view.position[i],
      );
      fn(camera);
      if (
        camera.view.target.every(
          (n, i) => Math.abs(n - camera.view.position[i] - direction[i]) < 1e-8,
        )
      )
        return;
      const [x, y] = camera.view.target;
      const [px, py] = camera.view.position;
      camera.view.up =
        Math.hypot(x - px, y - py) < 0.01 ? [0, -1, 0] : [0, 0, 1];
    });
  }
  function remove() {
    if (!selectedCamera.value) return false;
    const id = selectedCamera.value;
    getEditor().change(
      (m) =>
        (m.document.cameras = m.document.cameras.filter((c) => c.id !== id)),
    );
    clear();
    return true;
  }
  function gesture({ phase, point, hit }) {
    if (phase === "cancel") {
      previewCamera.value = null;
      drag = null;
      getEditor().pauseSave(false);
      if (getEditor().tool === "camera-focus") getEditor().tool = "select";
      return false;
    }
    if (getEditor().tool === "camera-focus") {
      if (phase === "start" && point) {
        update(
          (c) => (c.view.target = [point.x, point.y, point.elevation ?? 0.44]),
        );
        getEditor().tool = "select";
      }
      return true;
    }
    if (phase === "start" && hit?.cameraId) {
      focus(hit.cameraId);
      if (point)
        drag = { camera: clone(focusedCamera.value), origin: { ...point } };
      return true;
    }
    if (!drag) return false;
    if (phase === "move" && point) {
      previewCamera.value = translatedCamera(drag.camera, drag.origin, point);
      getEditor().pauseSave(true);
    }
    if (phase === "end") {
      if (previewCamera.value) {
        const view = previewCamera.value.view;
        update((c) => (c.view = view));
      }
      drag = null;
      previewCamera.value = null;
      getEditor().pauseSave(false);
    }
    return true;
  }
  return {
    selectedCamera,
    previewCamera,
    focusedCamera,
    focusCamera: focus,
    placeCamera: start,
    updateCamera: update,
    removeCamera: remove,
    clearCamera: clear,
    cameraGesture: gesture,
  };
}
