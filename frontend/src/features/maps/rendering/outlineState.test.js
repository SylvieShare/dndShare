import { expect, it } from "vitest";
import {
  BoxGeometry,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
} from "three";
import { dynamicOutlineState } from "./outlineState";

it("tracks shader motion only for visible occluders overlapping the mask", () => {
  const camera = new OrthographicCamera(-2, 2, 2, -2, 0.1, 20);
  camera.position.z = 5;
  camera.updateMatrixWorld(true);
  const mesh = new Mesh(
    new BoxGeometry(0.2, 0.2, 0.2),
    new MeshBasicMaterial(),
  );
  mesh.updateMatrixWorld(true);
  const region = { x: 35, y: 35, width: 30, height: 30 };
  mesh.userData.outlineClock = 0;
  const state = () => dynamicOutlineState([mesh], region, camera, 100, 100);
  expect(state()).toEqual([mesh.id, 0]);
  mesh.userData.outlineClock = 1;
  expect(state()).toEqual([mesh.id, 1]);
  mesh.visible = false;
  expect(state()).toEqual([]);
  mesh.visible = true;
  mesh.position.x = 10;
  mesh.updateMatrixWorld(true);
  expect(state()).toEqual([]);
  mesh.userData.outlineClock = 2;
  expect(state()).toEqual([]);
  mesh.geometry.dispose();
  mesh.material.dispose();
});
