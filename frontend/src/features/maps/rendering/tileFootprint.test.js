import { describe, expect, it } from "vitest";
import { Box3, Matrix4, Vector3 } from "three";
import { tileBounds, tileTransform } from "./tileTransform";
import { tilePlacementStatus } from "../lib/tilePlacement";

describe.each([
  ["UD-020", [-0.000143, -0.154701]],
  ["UD-078", [0.002601, 0.246171]],
])("%s decorative overhang", (id, placementOffset) => {
  const model = { id, width: 1, height: 1, mountDepth: 0.15, placementOffset };
  it("fits at the map edge next to a tile in the neighbouring cell", () => {
    const neighbour = { id: "floor", width: 1, height: 1 };
    const document = {
      width: 4,
      height: 4,
      tiles: [
        { id: "floor", modelId: "floor", x: 3, y: 2, rotation: 0, level: 0 },
      ],
    };
    const tile = { id: "tile", modelId: id, x: 3, y: 3, rotation: 0, level: 0 };
    expect(tilePlacementStatus(document, tile, [model, neighbour]).valid).toBe(
      true,
    );
    expect(
      tilePlacementStatus(document, { ...tile, y: 2 }, [model, neighbour])
        .valid,
    ).toBe(false);
  });
  it.each([0, 90, 180, 270])(
    "centres the mounting base at rotation %i",
    (rotation) => {
      const tile = {
        id: "tile",
        modelId: id,
        x: 3,
        y: 3,
        rotation,
        elevation: 0.7,
      };
      const mountCenter = new Vector3(
        -placementOffset[0],
        0.15,
        -placementOffset[1],
      );
      mountCenter.applyMatrix4(tileTransform(tile, model));
      expect(mountCenter.x).toBeCloseTo(3.5);
      expect(mountCenter.y).toBeCloseTo(0.7);
      expect(mountCenter.z).toBeCloseTo(3.5);
    },
  );
  it("retains the complete visible bounds beyond the occupied cell", () => {
    const geometry = {
      boundingBox: new Box3(new Vector3(-0.5, 0, -1), new Vector3(0.5, 2, 1)),
    };
    const loaded = { parts: [{ geometry, matrix: new Matrix4() }] };
    const tile = { x: 0, y: 0, rotation: 0 };
    const bounds = tileBounds(tile, model, loaded);
    expect(bounds.min.z).toBeLessThan(0);
    expect(bounds.max.z).toBeGreaterThan(1);
    expect(bounds.getSize(new Vector3()).z).toBeCloseTo(2);
  });
});
