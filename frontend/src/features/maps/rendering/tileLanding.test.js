import { expect, it, vi } from "vitest";
import { BoxGeometry, Matrix4, MeshStandardMaterial, Vector3 } from "three";
import { createTilePreview } from "./tilePreview";
import { landingTarget } from "./tileLanding";
const tile = {
  modelId: "floor",
  x: 1,
  y: 1,
  rotation: 0,
  level: 1,
  elevation: 0.6,
};

it("matches newly assigned UUIDs and returns cancelled existing tiles to their saved positions", () => {
  const placed = { ...tile, id: "new" };
  expect(landingTarget(tile, [placed])).toMatchObject({
    hidden: ["new"],
    fade: false,
  });
  expect(landingTarget({ ...placed, x: 4 }, [placed]).target.x).toBe(1);
  expect(landingTarget(tile, [])).toMatchObject({ hidden: [], fade: true });
});
it("raises a tile, hides the committed copy during descent, and restores it after landing", () => {
  const geometry = new BoxGeometry(1, 0.4, 1),
    material = new MeshStandardMaterial(),
    done = vi.fn();
  const preview = createTilePreview(
    {
      metadata: () => ({ width: 1, height: 1, mountDepth: 0.2 }),
      model: () => ({ parts: [{ geometry, material, matrix: new Matrix4() }] }),
    },
    done,
  );
  const y = () => {
    const matrix = new Matrix4();
    preview.root.children[0].getMatrixAt(0, matrix);
    return new Vector3().setFromMatrixPosition(matrix).y;
  };
  preview.update(tile);
  preview.advance(16);
  expect(y()).toBeGreaterThan(0.4);
  expect(y()).toBeLessThan(0.65);
  preview.advance(3000);
  expect(y()).toBeCloseTo(0.65);
  const placed = { ...tile, id: "new" };
  preview.update(null, [placed]);
  expect(preview.hiddenIds()).toEqual(["new"]);
  preview.advance(80);
  expect(y()).toBeGreaterThan(0.4);
  expect(y()).toBeLessThan(0.65);
  expect(preview.posed("new").elevation).toBeGreaterThan(0.6);
  preview.advance(3000);
  expect(preview.hiddenIds()).toEqual([]);
  expect(preview.root.visible).toBe(false);
  expect(done).toHaveBeenCalledOnce();
  preview.destroy();
  geometry.dispose();
  material.dispose();
});
