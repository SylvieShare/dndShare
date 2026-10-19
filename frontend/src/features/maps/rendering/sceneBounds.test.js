import { expect, it } from "vitest";
import {
  BoxGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
} from "three";
import { sceneBounds } from "./sceneBounds";

it("frames instances in world space and refreshes their cached box after motion", () => {
  const root = new Group(),
    geometry = new BoxGeometry(),
    material = new MeshBasicMaterial();
  const mesh = new InstancedMesh(geometry, material, 1);
  root.add(mesh);
  mesh.setMatrixAt(0, new Matrix4().makeTranslation(4, 2, 6));
  expect(sceneBounds(root).min.toArray()).toEqual([3.5, 1.5, 5.5]);
  mesh.setMatrixAt(0, new Matrix4().makeTranslation(8, 3, 9));
  expect(sceneBounds(root).min.toArray()).toEqual([7.5, 2.5, 8.5]);
  mesh.visible = false;
  expect(sceneBounds(root).isEmpty()).toBe(true);
  mesh.dispose();
  geometry.dispose();
  material.dispose();
});
