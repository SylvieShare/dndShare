import { expect, it } from "vitest";
import {
  InterleavedBuffer,
  InterleavedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  SphereGeometry,
  Vector3,
} from "three";
import { MeshBVH } from "three-mesh-bvh";
import { modelRaycast, prepareModelPicking } from "./modelPicking";

it("shares one BVH without changing GLB buffers and preserves instance IDs and intersection distances", async () => {
  const geometry = new SphereGeometry(0.4, 32, 24),
    positions = geometry.attributes.position.array,
    index = geometry.index.array;
  const originalRaycast = Mesh.prototype.raycast;
  await prepareModelPicking(geometry, async (input) =>
    MeshBVH.serialize(new MeshBVH(input, { indirect: true })),
  );
  expect(geometry.attributes.position.array).toBe(positions);
  expect(geometry.index.array).toBe(index);
  expect(Mesh.prototype.raycast).toBe(originalRaycast);
  const material = new MeshBasicMaterial(),
    mesh = new InstancedMesh(geometry, material, 2);
  mesh.setMatrixAt(0, new Matrix4());
  mesh.setMatrixAt(1, new Matrix4().makeTranslation(2, 0, 0));
  const ray = new Raycaster(new Vector3(2, 3, 0), new Vector3(0, -1, 0));
  const baseline = ray.intersectObject(mesh);
  mesh.raycast = modelRaycast;
  ray.firstHitOnly = true;
  const hits = ray.intersectObject(mesh);
  expect(hits[0].instanceId).toBe(1);
  expect(hits[0].distance).toBeCloseTo(baseline[0].distance, 8);
  geometry.dispose();
  material.dispose();
  mesh.dispose();
});

it("accelerates non-indexed interleaved geometry without detaching its shared attribute stream", async () => {
  const geometry = new SphereGeometry(0.4, 24, 16).toNonIndexed();
  const original = geometry.attributes.position,
    data = new Float32Array(original.count * 6);
  for (let i = 0; i < original.count; i++) {
    data[i * 6] = original.getX(i);
    data[i * 6 + 1] = original.getY(i);
    data[i * 6 + 2] = original.getZ(i);
  }
  const stream = new InterleavedBuffer(data, 6);
  geometry.setAttribute(
    "position",
    new InterleavedBufferAttribute(stream, 3, 0),
  );
  const material = new MeshBasicMaterial(),
    mesh = new Mesh(geometry, material);
  const ray = new Raycaster(new Vector3(0.03, 3, 0.02), new Vector3(0, -1, 0));
  const before = ray.intersectObject(mesh)[0];
  await prepareModelPicking(geometry, async (input) =>
    MeshBVH.serialize(new MeshBVH(input, { indirect: true })),
  );
  mesh.raycast = modelRaycast;
  ray.firstHitOnly = true;
  expect(ray.intersectObject(mesh)[0].distance).toBeCloseTo(before.distance, 8);
  expect(geometry.index).toBeNull();
  expect(geometry.attributes.position.data.array).toBe(data);
  expect(data.byteLength).toBeGreaterThan(0);
  geometry.dispose();
  material.dispose();
});
