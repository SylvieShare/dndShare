import { expect, it } from "vitest";
import { OrthographicCamera } from "three";
import { applySceneCamera, cameraFrame, worldVector } from "./sceneCameraView";
import { mapCamera } from "./mapCamera";
const pose = {
  position: [3, 2, 5],
  target: [3, 5, 0.44],
  up: [0, 0, 1],
  width: 8,
  aspect: 16 / 9,
};
it("camera frame corners use the same axes, target and size as the preview", () => {
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.01, 2000);
  applySceneCamera(camera, pose);
  const points = cameraFrame(pose);
  expect(camera.position.toArray()).toEqual([3, 5, 2]);
  for (const p of points) {
    const projected = p.clone().project(camera);
    expect(Math.abs(projected.x)).toBeCloseTo(1);
    expect(Math.abs(projected.y)).toBeCloseTo(1);
  }
  expect(
    points
      .reduce((sum, p) => sum.add(p), worldVector([0, 0, 0]))
      .multiplyScalar(0.25)
      .distanceTo(worldVector(pose.target)),
  ).toBeLessThan(1e-10);
});
it("captured editor pose is frozen while later camera movements continue independently", () => {
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.01, 2000);
  const controller = mapCamera(
    camera,
    { setSize() {}, domElement: {} },
    { clientWidth: 800, clientHeight: 450 },
    () => {},
  );
  controller.update({ fit: false, x: 6, y: 5 });
  const frozen = controller.capture();
  controller.update({ x: 9, y: 12 });
  expect(frozen.target).toEqual([6, 5, 0.44]);
  controller.update({ view: pose });
  expect(controller.capture()).toEqual(pose);
  expect(controller.getView().cellPixels).toBe(100);
});
it("creating a nearby camera preserves the complete orthographic frame, including objects behind its marker", async () => {
  const { cameraFromEditor } = await import("../lib/sceneCameras");
  const source = {
    position: [280, 280, 280],
    target: [6, 5, 0.44],
    up: [-0.7, -0.7, 0],
    width: 20,
    aspect: 1.7,
  };
  const saved = cameraFromEditor(source);
  const original = new OrthographicCamera(-1, 1, 1, -1, 0.01, 2000),
    nearby = original.clone();
  applySceneCamera(original, source);
  applySceneCamera(nearby, saved);
  for (const point of [
    [0, 0, 0],
    [10, 8, 32],
    [160, 160, 3],
  ]) {
    const before = worldVector(point).project(original),
      after = worldVector(point).project(nearby);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
    expect(Math.abs(after.z)).toBeLessThan(1);
  }
  expect(
    Math.hypot(...saved.position.map((n, i) => n - saved.target[i])),
  ).toBeCloseTo(5);
});
