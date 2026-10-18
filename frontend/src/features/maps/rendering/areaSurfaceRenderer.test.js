import { expect, it, vi } from "vitest";
import { BoxGeometry, Color, Mesh, MeshBasicMaterial, Scene } from "three";
import { applyAreaOpacity } from "./areaOpacity";
import { renderAreaSurfaces } from "./areaSurfaceRenderer";

function setup() {
  const scene = new Scene();
  scene.background = new Color(0x161b23);
  const materials = [
    new MeshBasicMaterial(),
    new MeshBasicMaterial(),
    new MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      opacity: 0.3,
    }),
    new MeshBasicMaterial({ visible: false }),
  ];
  for (const material of materials)
    scene.add(new Mesh(new BoxGeometry(), material));
  applyAreaOpacity(scene.children[1], 0.5);
  const gpu = {
    autoClear: true,
    shadowMap: { autoUpdate: false, needsUpdate: true },
    render: vi.fn(() => {
      gpu.shadowMap.needsUpdate = false;
    }),
  };
  return { scene, materials, gpu };
}

it("keeps opaque backgrounds, alpha annotations and shared material state across the depth pass", () => {
  const { scene, materials, gpu } = setup(),
    background = scene.background,
    frames = [];
  gpu.render.mockImplementation(() => {
    frames.push(materials.map((m) => [m.visible, m.colorWrite, m.depthWrite]));
    gpu.shadowMap.needsUpdate = false;
  });
  renderAreaSurfaces(gpu, scene, {});
  expect(frames).toEqual([
    [
      [true, true, true],
      [false, true, false],
      [false, true, false],
      [false, true, true],
    ],
    [
      [false, true, true],
      [true, false, true],
      [false, true, false],
      [false, true, true],
    ],
    [
      [false, true, true],
      [true, true, false],
      [true, true, false],
      [false, true, true],
    ],
  ]);
  expect(scene.background).toBe(background);
  expect(materials.map((m) => m.visible)).toEqual([true, true, true, false]);
  expect(gpu.autoClear).toBe(true);
  // Do not re-arm a shadow update already consumed by the first pass.
  expect(gpu.shadowMap).toEqual({ autoUpdate: false, needsUpdate: false });
});

it("restores scene/material/renderer state even when the depth pass fails", () => {
  const { scene, materials, gpu } = setup(),
    background = scene.background;
  gpu.render.mockImplementationOnce(() => {
    gpu.shadowMap.needsUpdate = false;
  });
  gpu.render.mockImplementationOnce(() => {
    throw new Error("draw failed");
  });
  expect(() => renderAreaSurfaces(gpu, scene, {})).toThrow("draw failed");
  expect(scene.background).toBe(background);
  expect(materials.map((m) => [m.visible, m.colorWrite, m.depthWrite])).toEqual(
    [
      [true, true, true],
      [true, true, false],
      [true, true, false],
      [false, true, true],
    ],
  );
  expect(gpu.autoClear).toBe(true);
  expect(gpu.shadowMap).toEqual({ autoUpdate: false, needsUpdate: false });
});

it("uses one ordinary render when no opaque area surface is fading", () => {
  const { scene, gpu } = setup();
  applyAreaOpacity(scene.children[1], 1);
  renderAreaSurfaces(gpu, scene, {});
  expect(gpu.render).toHaveBeenCalledOnce();
});
