import { expect, it, vi } from "vitest";
import { effectScope, nextTick, reactive, ref } from "vue";
import { editorCameras } from "./editorCameras";
import { useEditorJournal } from "./useEditorJournal";
const view = {
  position: [20, 12, 18],
  target: [6.2, 3.7, 0.44],
  up: [-0.6, -0.8, 0],
  width: 16,
  aspect: 1.6,
};
function setup() {
  let controller;
  const e = reactive({
    draft: { document: {} },
    tool: "select",
    dismissFocus() {
      controller.clearCamera();
    },
    change(fn) {
      fn(this.draft);
    },
    pauseSave() {},
  });
  controller = editorCameras(
    () => e,
    () => view,
  );
  return { e, c: controller };
}
it("creates the current framing immediately without a placement gesture or modifying its source", () => {
  const { e, c } = setup();
  c.placeCamera();
  expect(e.tool).toBe("select");
  expect(e.draft.document.cameras).toHaveLength(1);
  const camera = e.draft.document.cameras[0];
  expect(camera.view).toMatchObject({
    target: view.target,
    up: view.up,
    width: 16,
    aspect: 1.6,
  });
  expect(view.position).toEqual([20, 12, 18]);
  c.updateCamera((c) => (c.name = "Новый вид"));
  c.updateCamera((c) => (c.view.width = 12));
  expect(camera.view.up).toEqual(view.up);
  expect(c.removeCamera()).toBe(true);
  expect(e.draft.document.cameras).toEqual([]);
});
it("drags freely from the grabbed point in a horizontal plane, commits once and cancels without changing the camera", () => {
  const { e, c } = setup();
  c.placeCamera();
  const camera = e.draft.document.cameras[0];
  const original = JSON.parse(JSON.stringify(camera.view));
  const origin = {
    x: original.position[0] + 0.07,
    y: original.position[1] - 0.08,
    elevation: original.position[2],
  };
  c.cameraGesture({
    phase: "start",
    hit: { cameraId: camera.id },
    point: origin,
  });
  c.cameraGesture({
    phase: "move",
    point: { x: origin.x + 0.234, y: origin.y + 0.477, elevation: 0 },
  });
  expect(c.previewCamera.value.view.position[0]).toBeCloseTo(
    original.position[0] + 0.234,
  );
  expect(c.previewCamera.value.view.position[1]).toBeCloseTo(
    original.position[1] + 0.477,
  );
  expect(c.previewCamera.value.view.position[2]).toBe(original.position[2]);
  expect(camera.view).toEqual(original);
  c.cameraGesture({ phase: "end" });
  expect(camera.view.target[0]).toBeCloseTo(original.target[0] + 0.234);
  expect(camera.view.up).toEqual(original.up);
  const saved = JSON.parse(JSON.stringify(camera.view));
  c.cameraGesture({
    phase: "start",
    hit: { cameraId: camera.id },
    point: origin,
  });
  c.cameraGesture({ phase: "move", point: { x: 10, y: 11 } });
  c.cameraGesture({ phase: "cancel" });
  expect(camera.view).toEqual(saved);
  expect(c.previewCamera.value).toBeNull();
});

it("hovers parts independently and drags only the focus onto a surface, with cancel and invalid-pose protection", () => {
  const { e, c } = setup();
  c.placeCamera();
  const camera = e.draft.document.cameras[0],
    original = JSON.parse(JSON.stringify(camera));
  c.cameraGesture({
    phase: "hover",
    hit: { cameraId: camera.id, cameraPart: "target" },
  });
  expect(c.hoveredCameraPart.value).toBe("target");
  c.cameraGesture({
    phase: "start",
    hit: { cameraId: camera.id, cameraPart: "target" },
    point: { x: 6, y: 4, elevation: 0.44 },
  });
  c.cameraGesture({ phase: "hold" });
  c.cameraGesture({ phase: "move", point: { x: 4.2, y: 2.7, elevation: 1.8 } });
  expect(c.draggingCameraPart.value).toBe("target");
  expect(c.previewCamera.value.view.position).toEqual(original.view.position);
  expect(c.previewCamera.value.view.target).toEqual([4.2, 2.7, 1.8]);
  expect(camera.view).toEqual(original.view);
  c.cameraGesture({ phase: "cancel" });
  expect(camera.view).toEqual(original.view);
  expect(c.draggingCameraPart.value).toBe("");
  c.cameraGesture({
    phase: "start",
    hit: { cameraId: camera.id, cameraPart: "target" },
    point: { x: 6, y: 4 },
  });
  const [x, y, elevation] = camera.view.position;
  c.cameraGesture({ phase: "move", point: { x, y, elevation } });
  expect(c.previewCamera.value).toBeNull();
  c.cameraGesture({ phase: "move", point: { x: 7.4, y: 5.2, elevation: 0.8 } });
  c.cameraGesture({ phase: "end" });
  expect(camera.view.target).toEqual([7.4, 5.2, 0.8]);
  expect(camera.view.position).toEqual(original.view.position);
  expect(c.previewCamera.value).toBeNull();
});

it("groups continuous camera slider edits into one undo entry and keeps the other coordinates", async () => {
  vi.useFakeTimers();
  const scope = effectScope(),
    draft = ref({
      name: "Map",
      document: {
        cameras: [
          { id: "camera", name: "Вид", view: JSON.parse(JSON.stringify(view)) },
        ],
      },
    });
  const journal = scope.run(() => useEditorJournal(draft, true));
  const e = reactive({
    draft,
    checkpoint: journal.checkpoint,
    commitEdit: journal.commit,
  });
  const c = editorCameras(
    () => e,
    () => view,
  );
  try {
    c.selectedCamera.value = "camera";
    c.editCamera("height", 6.3);
    c.editCamera("height", 7.2);
    c.finishCameraEdit();
    await nextTick();
    expect(draft.value.document.cameras[0].view.position).toEqual([
      20, 12, 7.2,
    ]);
    expect(draft.value.document.cameras[0].view.target).toEqual(view.target);
    expect(journal.history.value).toHaveLength(1);
    expect(journal.undo()).toBe(true);
    expect(draft.value.document.cameras[0].view.position).toEqual(
      view.position,
    );
    expect(journal.redo()).toBe(true);
    c.editCamera("width", 13.7);
    vi.advanceTimersByTime(350);
    expect(journal.history.value).toHaveLength(2);
    expect(journal.undo()).toBe(true);
    expect(draft.value.document.cameras[0].view.width).toBe(view.width);
  } finally {
    c.disposeCameras();
    scope.stop();
    vi.useRealTimers();
  }
});
