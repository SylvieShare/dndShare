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
