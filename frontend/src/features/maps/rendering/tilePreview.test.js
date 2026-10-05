import { expect, it } from "vitest";
import { BoxGeometry, Matrix4, MeshStandardMaterial, Vector3 } from "three";
import { createTilePreview } from "./tilePreview";
it("eases vertical snapping in the actual instance transform", () => {
  const geometry = new BoxGeometry(1, 0.4, 1),
    material = new MeshStandardMaterial();
  const preview = createTilePreview({
    metadata: () => ({ width: 1, height: 1 }),
    model: () => ({ parts: [{ geometry, material, matrix: new Matrix4() }] }),
  });
  const tile = {
    id: "tile",
    modelId: "floor",
    x: 1,
    y: 1,
    rotation: 0,
    level: 0,
    elevation: 0,
  };
  preview.update(tile, "render");
  preview.advance(16);
  preview.update({ ...tile, level: 1, elevation: 0.6 }, "render");
  expect(preview.advance(16)).toBe(true);
  const matrix = new Matrix4(),
    position = new Vector3();
  preview.root.children[0].getMatrixAt(0, matrix);
  position.setFromMatrixPosition(matrix);
  expect(position.y).toBeGreaterThan(0);
  expect(position.y).toBeLessThan(0.6);
  preview.advance(3000);
  preview.root.children[0].getMatrixAt(0, matrix);
  position.setFromMatrixPosition(matrix);
  expect(position.y).toBeCloseTo(0.82, 5);
  preview.destroy();
  geometry.dispose();
  material.dispose();
});
