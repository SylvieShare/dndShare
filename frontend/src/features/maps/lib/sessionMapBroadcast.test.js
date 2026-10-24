import { expect, it } from "vitest";
import { toggleMapBroadcast } from "./sessionMapBroadcast";
it("switches to the explicitly requested map with its own overview instead of reusing another map camera", () => {
  const display = {
    mapId: "a",
    visible: true,
    camera: { sceneId: "camera-a", view: { width: 8 }, fit: false, x: 2, y: 3 },
  };
  expect(
    toggleMapBroadcast(display, {
      id: "b",
      document: { width: 20, height: 12 },
    }),
  ).toEqual({
    mapId: "b",
    visible: true,
    camera: { sceneId: "", view: null, fit: true, x: 10, y: 6 },
  });
  expect(display.camera.sceneId).toBe("camera-a");
});
it("toggles the current map without discarding its selected camera", () => {
  const display = {
    mapId: "a",
    visible: true,
    camera: { sceneId: "camera-a" },
  };
  expect(toggleMapBroadcast(display, { id: "a" })).toEqual({
    mapId: "a",
    visible: false,
  });
  expect(
    toggleMapBroadcast({ ...display, visible: false }, { id: "a" }),
  ).toEqual({ mapId: "a", visible: true });
});
