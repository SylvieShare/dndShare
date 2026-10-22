import { expect, it } from "vitest";
import { reactive } from "vue";
import { editorCameras } from "./editorCameras";
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
