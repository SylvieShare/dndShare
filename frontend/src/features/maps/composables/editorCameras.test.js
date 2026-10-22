import { expect, it } from "vitest";
import { reactive } from "vue";
import { editorCameras } from "./editorCameras";
it("places and edits a camera, moves target with its body, cancels previews and removes it", () => {
  let c;
  const e = reactive({
    draft: { document: {} },
    tool: "select",
    dismissFocus() {
      c.clearCamera();
    },
    change(fn) {
      fn(this.draft);
    },
    pauseSave() {},
  });
  c = editorCameras(() => e);
  c.placeCamera();
  c.cameraGesture({ phase: "start", point: { x: 3.2, y: 4.8 } });
  const camera = e.draft.document.cameras[0];
  expect(camera.view.position).toEqual([3.5, 4.5, 3.44]);
  c.cameraGesture({ phase: "start", hit: { cameraId: camera.id } });
  c.cameraGesture({ phase: "move", point: { x: 6, y: 7 } });
  expect(c.previewCamera.value.view.target).toEqual([6.5, 10.5, 0.44]);
  c.cameraGesture({ phase: "cancel" });
  expect(camera.view.position[0]).toBe(3.5);
  c.updateCamera((c) => (c.view.width = 12));
  expect(camera.view.width).toBe(12);
  expect(c.removeCamera()).toBe(true);
  expect(e.draft.document.cameras).toEqual([]);
});
