import { computed, ref } from "vue";
import { uid, clone } from "../lib/mapModel";
export function editorCameras(getEditor) {
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
    clear();
    getEditor().dismissFocus();
    getEditor().tool = "camera";
  }
  function pose(point) {
    return {
      position: [
        Math.floor(point.x) + 0.5,
        Math.floor(point.y) + 0.5,
        (point.elevation || 0.44) + 3,
      ],
      target: [Math.floor(point.x) + 0.5, Math.floor(point.y) + 3.5, 0.44],
      up: [0, 0, 1],
      width: 8,
      aspect: 16 / 9,
    };
  }
  function update(fn) {
    if (!focusedCamera.value) return;
    getEditor().change((m) => {
      const camera = m.document.cameras.find(
        (c) => c.id === selectedCamera.value,
      );
      fn(camera);
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
      if (["camera", "camera-focus"].includes(getEditor().tool))
        getEditor().tool = "select";
      return false;
    }
    if (getEditor().tool === "camera-focus") {
      if (phase === "start" && point) {
        update(
          (c) => (c.view.target = [point.x, point.y, point.elevation || 0.44]),
        );
        getEditor().tool = "select";
      }
      return true;
    }
    if (getEditor().tool === "camera") {
      if (phase === "hover" && point)
        previewCamera.value = {
          id: "preview-camera",
          name: "Камера",
          view: pose(point),
        };
      if (phase === "start" && point) {
        const camera = {
          id: uid(),
          name: `Камера ${(getEditor().draft.document.cameras?.length || 0) + 1}`,
          view: pose(point),
        };
        getEditor().change((m) => (m.document.cameras ||= []).push(camera));
        selectedCamera.value = camera.id;
        previewCamera.value = null;
        getEditor().tool = "select";
      }
      return true;
    }
    if (phase === "start" && hit?.cameraId) {
      focus(hit.cameraId);
      drag = clone(focusedCamera.value);
      return true;
    }
    if (!drag) return false;
    if (phase === "move" && point) {
      const x = Math.floor(point.x) + 0.5,
        y = Math.floor(point.y) + 0.5,
        dx = x - drag.view.position[0],
        dy = y - drag.view.position[1];
      previewCamera.value = {
        ...drag,
        view: {
          ...drag.view,
          position: [x, y, drag.view.position[2]],
          target: [
            drag.view.target[0] + dx,
            drag.view.target[1] + dy,
            drag.view.target[2],
          ],
        },
      };
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
