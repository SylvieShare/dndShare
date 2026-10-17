import { expect, it } from "vitest";
import { BoxGeometry, Matrix4, MeshStandardMaterial } from "three";
import { createObjectPreview } from "./objectPreview";
it("preserves opaque materials and depth while dragging a model object", () => {
  const geometry = new BoxGeometry(),
    material = new MeshStandardMaterial();
  const preview = createObjectPreview(
    { material: (m) => m },
    {
      model: () => ({ parts: [{ geometry, material, matrix: new Matrix4() }] }),
    },
  );
  preview.update({
    id: "chest",
    modelId: "model",
    x: 1,
    y: 2,
    rotation: 0,
    scale: 1,
    moving: true,
  });
  preview.advance(16);
  const actual = preview.root.children[0].children[0].material;
  expect(actual.opacity).toBe(1);
  expect(actual.transparent).toBe(false);
  expect(actual.depthWrite).toBe(true);
  preview.destroy();
  geometry.dispose();
  material.dispose();
});
it("uses a coarse object while full detail is pending and replaces it without pointer movement", () => {
  const lod = new BoxGeometry(1, 1, 1),
    full = new BoxGeometry(1, 2, 1),
    material = new MeshStandardMaterial();
  let ready = false;
  const assets = {
    model: (_, tier) =>
      tier === "render" && !ready
        ? null
        : {
            parts: [
              {
                geometry: tier === "render" ? full : lod,
                material,
                matrix: new Matrix4(),
              },
            ],
          },
  };
  const preview = createObjectPreview({ material: (m) => m }, assets);
  const item = {
    id: "chest",
    modelId: "model",
    x: 5,
    y: 4,
    rotation: 0,
    scale: 1,
  };
  preview.update(item);
  expect(preview.root.children[0].children[0].geometry).toBe(lod);
  ready = true;
  preview.update(item);
  preview.advance(16);
  expect(preview.root.children[0].children[0].geometry).toBe(full);
  expect(preview.root.children[0].position.x).toBe(5);
  preview.destroy();
  lod.dispose();
  full.dispose();
  material.dispose();
});
