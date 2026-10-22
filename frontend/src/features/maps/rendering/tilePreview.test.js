import { expect, it } from "vitest";
import { BoxGeometry, Matrix4, MeshStandardMaterial, Vector3 } from "three";
import { createTilePreview } from "./tilePreview";
it("eases vertical snapping in the actual instance transform", () => {
  const geometry = new BoxGeometry(1, 0.4, 1),
    material = new MeshStandardMaterial();
  const preview = createTilePreview({
    metadata: () => ({ width: 1, height: 1 }),
    model: (_, tier) =>
      tier === "render"
        ? { parts: [{ geometry, material, matrix: new Matrix4() }] }
        : null,
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
  preview.update(tile);
  preview.advance(16);
  expect(preview.root.children[0].material.opacity).toBe(1);
  expect(preview.root.children[0].material.transparent).toBe(false);
  expect(preview.root.children[0].material.depthWrite).toBe(true);
  preview.update({ ...tile, level: 1, elevation: 0.6 });
  expect(preview.advance(16)).toBe(true);
  const matrix = new Matrix4(),
    position = new Vector3();
  preview.root.children[0].getMatrixAt(0, matrix);
  position.setFromMatrixPosition(matrix);
  preview
    .transform("tile")
    .elements.forEach((v, i) => expect(v).toBeCloseTo(matrix.elements[i], 6));
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
it("uses the loaded LOD immediately and forgets motion when released before either mesh is ready", () => {
  const geometry = new BoxGeometry(),
    material = new MeshStandardMaterial(),
    lod = { parts: [{ geometry, material, matrix: new Matrix4() }] };
  let coarse = true,
    full = false;
  const assets = {
    metadata: () => ({ width: 1, height: 1 }),
    model: (_, tier) => ((tier === "render" ? full : coarse) ? lod : null),
  };
  const preview = createTilePreview(assets);
  const tile = {
    modelId: "tile",
    x: 2,
    y: 3,
    rotation: 0,
    level: 0,
    elevation: 0,
  };
  preview.update(tile);
  expect(preview.root.children).toHaveLength(1);
  preview.update(null, []);
  preview.advance(3000);
  coarse = false;
  preview.update(tile);
  preview.update({ ...tile, x: 5 });
  preview.update(null, [{ ...tile, id: "placed", x: 5 }]);
  expect(preview.hiddenIds()).toEqual([]);
  expect(preview.modelIds().size).toBe(0);
  full = true;
  preview.update(null, [{ ...tile, id: "placed", x: 5 }]);
  expect(preview.root.children).toHaveLength(0);
  expect(preview.advance(16)).toBe(false);
  preview.destroy();
  geometry.dispose();
  material.dispose();
});
it("reflects the placement preview without negative instance scales and settles after repeated pointer updates", () => {
  const geometry = new BoxGeometry(1, 0.4, 1),
    material = new MeshStandardMaterial();
  const assets = {
    metadata: () => ({ width: 1, height: 1 }),
    model: () => ({ parts: [{ geometry, material, matrix: new Matrix4() }] }),
  };
  const preview = createTilePreview(assets),
    tile = { id: "a", modelId: "floor", x: 2, y: 3, rotation: 0, elevation: 0 };
  preview.update(tile);
  preview.advance(16);
  const target = { ...tile, mirrored: true };
  preview.update(target);
  const matrix = new Matrix4();
  for (let n = 0; n < 24; n++) {
    preview.update(target);
    preview.advance(20);
    const mesh = preview.root.children[0];
    mesh.getMatrixAt(0, matrix);
    expect(matrix.determinant()).toBeGreaterThan(0);
  }
  expect(preview.transform("a").determinant()).toBeCloseTo(-1);
  expect(preview.root.children[0].matrixWorld.determinant()).toBe(-1);
  preview.destroy();
  geometry.dispose();
  material.dispose();
});
