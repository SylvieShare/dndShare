import { afterEach, expect, it, vi } from "vitest";
import { OrthographicCamera, Vector3 } from "three";
import { cameraFocusTarget, useCameraFocus } from "./useCameraFocus";
import { mapCamera } from "../rendering/mapCamera";
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("centres an elevated light in the actual isometric projection", () => {
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.01, 2000);
  const view = mapCamera(
    camera,
    { setSize() {}, domElement: {} },
    { clientWidth: 1000, clientHeight: 800 },
    () => {},
  );
  view.document({ width: 12, height: 10 }, {});
  const point = { x: 4, y: 8, elevation: 3 };
  view.update(cameraFocusTarget(view.getView(), point));
  const pixel = view.project(new Vector3(point.x, point.elevation, point.y));
  expect(pixel.x).toBeCloseTo(500);
  expect(pixel.y).toBeCloseTo(400);
});
it("interpolates the camera and cancels pending motion on manual control or destruction", () => {
  const callbacks = new Map();
  let id = 0;
  vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
  vi.stubGlobal("requestAnimationFrame", (fn) => {
    callbacks.set(++id, fn);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (frame) => callbacks.delete(frame));
  vi.spyOn(performance, "now").mockReturnValue(0);
  let view = { x: 0, y: 0, tilt: 90, azimuth: 0, cellPixels: 50, fit: true };
  const apply = vi.fn((next) => {
    view = next;
  });
  const motion = useCameraFocus(() => view, apply);
  motion.focusAt({ x: 10, y: 6 });
  expect(apply).not.toHaveBeenCalled();
  const first = callbacks.get(id);
  callbacks.delete(id);
  first(120);
  expect(view.x).toBeGreaterThan(0);
  expect(view.x).toBeLessThan(10);
  expect(view.fit).toBe(false);
  motion.stop();
  expect(callbacks.size).toBe(0);
  motion.focusAt({ x: 10, y: 6 });
  const end = callbacks.get(id);
  callbacks.delete(id);
  end(400);
  expect(view.x).toBeCloseTo(10);
  expect(view.y).toBeCloseTo(6);
});
it("respects reduced motion when focusing a light", () => {
  vi.stubGlobal("window", { matchMedia: () => ({ matches: true }) });
  vi.stubGlobal("requestAnimationFrame", vi.fn());
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const apply = vi.fn();
  useCameraFocus(() => ({ x: 0, y: 0, tilt: 90 }), apply).focusAt({
    x: 3,
    y: 4,
  });
  expect(apply).toHaveBeenCalledWith(
    expect.objectContaining({ x: 3, y: 4, fit: false }),
  );
  expect(requestAnimationFrame).not.toHaveBeenCalled();
});
it("centres the source in the free viewport beside an inspector at different camera angles", () => {
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.01, 2000);
  const view = mapCamera(
    camera,
    { setSize() {}, domElement: {} },
    { clientWidth: 1000, clientHeight: 800 },
    () => {},
  );
  view.document({ width: 12, height: 10 }, {});
  for (const [tilt, azimuth] of [
    [35.2643897, 45],
    [90, 0],
    [55, 140],
  ]) {
    view.update({ tilt, azimuth });
    const point = { x: 4, y: 8, elevation: 3 };
    view.update(cameraFocusTarget(view.getView(), point, { x: -150, y: 80 }));
    const pixel = view.project(new Vector3(point.x, point.elevation, point.y));
    expect(pixel.x).toBeCloseTo(350);
    expect(pixel.y).toBeCloseTo(480);
  }
});
