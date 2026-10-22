import { expect, it } from "vitest";
import {
  BoxGeometry,
  Quaternion,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  PlaneGeometry,
  Raycaster,
  Vector3,
} from "three";
import { hitDecalSurface, projectedDecalGeometry } from "./decalGeometry";
import { MeshBVH } from "three-mesh-bvh";

const stamp = (extra = {}) => ({
  position: [0, 0, 0.05],
  normal: [0, 0, 1],
  width: 0.8,
  height: 0.6,
  depth: 0.2,
  rotation: 0,
  ...extra,
});
it("clips a thin wall to the visible face, preserving source buffers", () => {
  const source = new BoxGeometry(2, 2, 0.1),
    positions = source.attributes.position.array.slice();
  const geometry = projectedDecalGeometry(
    { geometry: source, matrix: new Matrix4() },
    stamp(),
  );
  expect(geometry.attributes.position.count).toBeGreaterThan(0);
  const p = geometry.attributes.position,
    uv = geometry.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    expect(p.getZ(i)).toBeCloseTo(0.05);
    expect(Math.abs(p.getX(i))).toBeLessThanOrEqual(0.400001);
    expect(Math.abs(p.getY(i))).toBeLessThanOrEqual(0.300001);
    expect(uv.getX(i)).toBeGreaterThanOrEqual(-0.000001);
    expect(uv.getY(i)).toBeLessThanOrEqual(1.000001);
  }
  expect(source.attributes.position.array).toEqual(positions);
});
it("projects on a floor with a transformed model part and rotation", () => {
  const part = {
    geometry: new PlaneGeometry(4, 4),
    matrix: new Matrix4().makeRotationX(-Math.PI / 2),
  };
  const geometry = projectedDecalGeometry(
    part,
    stamp({ position: [0, 0, 0], normal: [0, 1, 0], rotation: 35 }),
  );
  expect(geometry.attributes.position.count).toBeGreaterThan(0);
  for (let i = 0; i < geometry.attributes.position.count; i++)
    expect(geometry.attributes.position.getY(i)).toBeCloseTo(0);
});
it("converts an instanced surface hit back to owner coordinates, including part transforms", () => {
  const owner = new Matrix4().compose(
    new Vector3(4, 1, 2),
    new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.7),
    new Vector3(2, 2, 2),
  );
  const part = new Matrix4().makeRotationY(0.3).setPosition(0.3, 0.1, 0);
  const mesh = new InstancedMesh(
    new PlaneGeometry(2, 2),
    new MeshBasicMaterial(),
    1,
  );
  mesh.setMatrixAt(0, owner.clone().multiply(part));
  mesh.updateMatrixWorld(true);
  const point = new Vector3(0.3, 0.1, 0).applyMatrix4(owner);
  const direction = new Vector3(0, 0, 1).transformDirection(
    owner.clone().multiply(part),
  );
  const ray = new Raycaster(
    point.clone().addScaledVector(direction, 5),
    direction.clone().negate(),
  );
  const hit = ray.intersectObject(mesh)[0];
  const local = hitDecalSurface(hit, owner);
  local.position.forEach((value, i) =>
    expect(value).toBeCloseTo([0.3, 0.1, 0][i], 5),
  );
  const expected = new Vector3(0, 0, 1).transformDirection(part).toArray();
  local.normal.forEach((value, i) => expect(value).toBeCloseTo(expected[i], 5));
});
it("BVH candidate pruning preserves the same projected surface and shared index", () => {
  const source = new PlaneGeometry(4, 4, 40, 40);
  const part = { geometry: source, matrix: new Matrix4() };
  const plain = projectedDecalGeometry(
    part,
    stamp({ position: [0, 0, 0], rotation: 28 }),
  );
  const index = source.index.array.slice();
  source.boundsTree = new MeshBVH(source, { indirect: true });
  const accelerated = projectedDecalGeometry(
    part,
    stamp({ position: [0, 0, 0], rotation: 28 }),
  );
  const coordinates = (geometry) =>
    [...geometry.attributes.position.array]
      .map((v) => Math.round(v * 10000) || 0)
      .sort((a, b) => a - b);
  expect(coordinates(accelerated)).toEqual(coordinates(plain));
  expect(source.index.array).toEqual(index);
});
