import { expect, it, vi } from "vitest";
import {
  Box3,
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from "three";
import { createModelOrbitCamera } from "./modelOrbitCamera";

it("fits native transformed geometry tightly inside a portrait or landscape viewport", () => {
  const root = new Group(),
    material = new MeshBasicMaterial(),
    geometry = new BoxGeometry(0.5, 1, 0.25);
  const body = new Mesh(geometry, material),
    detail = new Mesh(geometry, material);
  body.position.set(-0.12, 0.5, 0.08);
  detail.position.set(0.4, 0.1, -0.2);
  detail.scale.set(0.06, 0.03, 0.08);
  root.add(body, detail);
  root.rotation.y = 0.4;
  root.updateMatrixWorld(true);
  const original = detail.matrix.clone();
  for (const [width, height] of [
    [360, 220],
    [220, 340],
  ]) {
    const host = { clientWidth: width, clientHeight: height },
      gpu = { setSize: vi.fn() };
    const view = createModelOrbitCamera(gpu, host, () => {}, {
      yaw: -1,
      pitch: 0.35,
      projectedFit: true,
    });
    view.fit(new Box3().setFromObject(root), root);
    const projected = [];
    root.traverse((node) => {
      if (!node.isMesh) return;
      const attribute = node.geometry.getAttribute("position");
      for (let i = 0; i < attribute.count; i++) {
        const world = new Vector3()
          .fromBufferAttribute(attribute, i)
          .applyMatrix4(node.matrixWorld);
        projected.push(view.project(world.toArray()));
      }
    });
    expect(
      projected.every(
        (p) => p.x >= 0 && p.x <= width && p.y >= 0 && p.y <= height,
      ),
    ).toBe(true);
    const spanX =
      Math.max(...projected.map((p) => p.x)) -
      Math.min(...projected.map((p) => p.x));
    const spanY =
      Math.max(...projected.map((p) => p.y)) -
      Math.min(...projected.map((p) => p.y));
    expect(Math.max(spanX / width, spanY / height)).toBeGreaterThan(0.87);
    expect(detail.matrix.equals(original)).toBe(true);
  }
  geometry.dispose();
  material.dispose();
});
