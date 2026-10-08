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
